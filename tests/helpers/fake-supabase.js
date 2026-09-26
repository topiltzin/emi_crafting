// A minimal in-memory fake of the @supabase/supabase-js client surface actually used by
// src/modules/db.js and src/modules/supabase-client.js. This lets unit/integration tests
// exercise real db.js logic (validation, ordering, storage-before-row-insert, error codes)
// without a network call or a live Supabase project.
//
// Not a full Postgrest/GoTrue/Storage reimplementation — only the operations db.js issues:
// select (incl. {count, head})/insert/update/delete with eq/is/in/not filters (eq accepts a
// `col->>key` JSON path), order, range, single/maybeSingle, and a trivial Storage bucket
// (upload/remove/createSignedUrl(s)) and Auth (getSession/signIn).

// A strictly-increasing clock (rather than `new Date().toISOString()`) so that rows created
// in the same test — which can easily land in the same millisecond — still sort deterministically
// by timestamp, matching how the real Postgres `now()` + insertion order behaves in practice.
let clockOffsetMs = 0;
function nowIso() {
  clockOffsetMs += 1;
  return new Date(Date.now() + clockOffsetMs).toISOString();
}

function defaultsFor(table) {
  if (table === 'albums') return { photo_count: 0, position: null, title: null };
  if (table === 'photos') {
    return {
      is_favorite: false,
      photo_date: null,
      thumbnail_storage_path: null,
      exif_json: null,
      tutorial_link: null,
      upload_date: nowIso()
    };
  }
  return {};
}

// Resolves plain columns and PostgREST `col->>key` JSON text paths.
function readColumn(row, col) {
  const [column, jsonKey] = col.split('->>');
  const value = row[column];
  if (jsonKey === undefined) return value;
  return value && value[jsonKey] != null ? String(value[jsonKey]) : null;
}

function matchFilters(row, filters) {
  return filters.every((filter) => {
    const value = readColumn(row, filter.col);
    if (filter.type === 'eq') return value === filter.val;
    if (filter.type === 'is') return (value ?? null) === filter.val;
    if (filter.type === 'not-is') return (value ?? null) !== filter.val;
    if (filter.type === 'in') return filter.vals.includes(value);
    return true;
  });
}

function applyOrder(rows, orders) {
  if (orders.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const order of orders) {
      const av = a[order.col];
      const bv = b[order.col];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) continue;
      if (aNull) return order.nullsFirst ? -1 : 1;
      if (bNull) return order.nullsFirst ? 1 : -1;
      if (av < bv) return order.ascending ? -1 : 1;
      if (av > bv) return order.ascending ? 1 : -1;
    }
    return 0;
  });
  return sorted;
}

export function createFakeSupabaseClient({ ownerId = 'owner-1', networkDown = false } = {}) {
  const tables = { albums: [], photos: [] };
  const storageObjects = new Set();
  let session = { user: { id: ownerId, email: 'owner@example.com' } };
  let uploadFailureCountdown = 0;
  let removeFailureCountdown = 0;
  const deleteFailureCountdowns = {};

  function checkNetwork() {
    if (networkDown) {
      const error = new TypeError('Failed to fetch');
      throw error;
    }
  }

  function createQueryBuilder(table) {
    const filters = [];
    const orders = [];
    let mode = 'select';
    let payload = null;
    let rangeSpec = null;
    let wantSingle = false;
    let wantMaybeSingle = false;
    let countOnly = false;

    const builder = {
      select(_columns, opts = {}) {
        countOnly = opts.head === true && opts.count === 'exact';
        return builder;
      },
      insert(row) {
        mode = 'insert';
        payload = row;
        return builder;
      },
      update(patch) {
        mode = 'update';
        payload = patch;
        return builder;
      },
      delete() {
        mode = 'delete';
        return builder;
      },
      eq(col, val) {
        filters.push({ type: 'eq', col, val });
        return builder;
      },
      is(col, val) {
        filters.push({ type: 'is', col, val });
        return builder;
      },
      not(col, operator, val) {
        if (operator !== 'is') throw new Error(`fake-supabase: unsupported not() operator ${operator}`);
        filters.push({ type: 'not-is', col, val });
        return builder;
      },
      in(col, vals) {
        filters.push({ type: 'in', col, vals });
        return builder;
      },
      order(col, opts = {}) {
        orders.push({ col, ascending: opts.ascending !== false, nullsFirst: !!opts.nullsFirst });
        return builder;
      },
      range(from, to) {
        rangeSpec = { from, to };
        return builder;
      },
      maybeSingle() {
        wantMaybeSingle = true;
        return builder;
      },
      single() {
        wantSingle = true;
        return builder;
      },
      then(onFulfilled, onRejected) {
        return execute().then(onFulfilled, onRejected);
      }
    };

    async function execute() {
      try {
        checkNetwork();
      } catch (error) {
        return { data: null, error };
      }

      const rows = tables[table];

      if (mode === 'insert') {
        const rowsToInsert = Array.isArray(payload) ? payload : [payload];
        const inserted = rowsToInsert.map((row) => {
          const record = {
            id: row.id || crypto.randomUUID(),
            created_at: nowIso(),
            updated_at: nowIso(),
            deleted_at: null,
            ...defaultsFor(table),
            ...row
          };
          rows.push(record);
          return { ...record };
        });
        return finalize(inserted);
      }

      let matched = rows.filter((row) => matchFilters(row, filters));

      if (mode === 'update') {
        matched.forEach((row) => Object.assign(row, payload));
        return finalize(matched.map((row) => ({ ...row })));
      }

      if (mode === 'delete') {
        if (deleteFailureCountdowns[table] > 0) {
          deleteFailureCountdowns[table] -= 1;
          return { data: null, error: new TypeError('Failed to fetch') };
        }
        for (const row of matched) {
          const idx = rows.indexOf(row);
          if (idx !== -1) rows.splice(idx, 1);
        }
        return finalize(matched.map((row) => ({ ...row })));
      }

      if (countOnly) {
        return { data: null, count: matched.length, error: null };
      }

      matched = applyOrder(matched, orders);
      if (rangeSpec) {
        matched = matched.slice(rangeSpec.from, rangeSpec.to + 1);
      }
      return finalize(matched.map((row) => ({ ...row })));
    }

    function finalize(rows) {
      if (wantSingle) {
        if (rows.length !== 1) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
        }
        return { data: rows[0], error: null };
      }
      if (wantMaybeSingle) {
        return { data: rows[0] || null, error: null };
      }
      return { data: rows, error: null };
    }

    return builder;
  }

  const storage = {
    from(bucket) {
      return {
        async upload(path, _bytes, _opts) {
          try {
            checkNetwork();
          } catch (error) {
            return { data: null, error };
          }
          if (uploadFailureCountdown > 0) {
            uploadFailureCountdown -= 1;
            return { data: null, error: new TypeError('Failed to fetch') };
          }
          storageObjects.add(`${bucket}/${path}`);
          return { data: { path }, error: null };
        },
        async remove(paths) {
          try {
            checkNetwork();
          } catch (error) {
            return { data: null, error };
          }
          if (removeFailureCountdown > 0) {
            removeFailureCountdown -= 1;
            return { data: null, error: new TypeError('Failed to fetch') };
          }
          for (const path of paths) storageObjects.delete(`${bucket}/${path}`);
          return { data: paths, error: null };
        },
        async createSignedUrl(path, _ttlSeconds) {
          try {
            checkNetwork();
          } catch (error) {
            return { data: null, error };
          }
          if (!storageObjects.has(`${bucket}/${path}`)) {
            return { data: null, error: { message: `Object not found: ${path}` } };
          }
          return { data: { signedUrl: `https://fake.local/storage/${bucket}/${path}` }, error: null };
        },
        async createSignedUrls(paths, _ttlSeconds) {
          try {
            checkNetwork();
          } catch (error) {
            return { data: null, error };
          }
          const data = paths.map((path) =>
            storageObjects.has(`${bucket}/${path}`)
              ? { path, signedUrl: `https://fake.local/storage/${bucket}/${path}`, error: null }
              : { path, signedUrl: null, error: `Object not found: ${path}` }
          );
          return { data, error: null };
        }
      };
    }
  };

  let functionHandler = null;

  const functions = {
    async invoke(name, options) {
      try {
        checkNetwork();
      } catch (error) {
        return { data: null, error: { message: error.message, context: null } };
      }
      if (!functionHandler) {
        return { data: null, error: { message: `No fake handler registered for function "${name}"`, context: null } };
      }
      const result = await functionHandler(name, options);
      if (result && result.errorBody) {
        return {
          data: null,
          error: {
            message: result.errorBody.message || 'Function invocation failed',
            context: { json: async () => result.errorBody }
          }
        };
      }
      return { data: result ? result.data : null, error: null };
    }
  };

  const auth = {
    async getSession() {
      return { data: { session }, error: null };
    },
    async signInWithPassword({ email }) {
      if (networkDown) {
        return { data: { session: null }, error: new TypeError('Failed to fetch') };
      }
      session = { user: { id: ownerId, email } };
      return { data: { session }, error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    }
  };

  return {
    from: (table) => createQueryBuilder(table),
    storage,
    auth,
    functions,
    // Test-only inspection/seeding hooks — not part of the real supabase-js surface.
    _ownerId: ownerId,
    _tables: tables,
    _storageObjects: storageObjects,
    _setNetworkDown(value) {
      networkDown = value;
    },
    _failNextUploads(count) {
      uploadFailureCountdown = count;
    },
    _failNextStorageRemoves(count) {
      removeFailureCountdown = count;
    },
    _failNextTableDeletes(table, count) {
      deleteFailureCountdowns[table] = count;
    },
    // result: {data} for success, or {errorBody: {error: 'CODE', message}} to simulate the
    // Edge Function's structured non-2xx response (see youtube-metadata/index.ts).
    _setFunctionHandler(handler) {
      functionHandler = handler;
    }
  };
}
