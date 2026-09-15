export class Album {
  constructor(data) {
    this.id = data.id;
    this.album_date = data.album_date; // YYYY-MM-DD
    this.title = data.title;
    this.photo_count = data.photo_count || 0;
    this.sort_order = data.sort_order || null;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.deleted_at = data.deleted_at;
  }

  validate() {
    // Validate album_date is ISO 8601
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.album_date)) {
      throw new Error('album_date must be ISO 8601 format (YYYY-MM-DD)');
    }

    // Validate title max length
    if (this.title && this.title.length > 255) {
      throw new Error('title must be max 255 characters');
    }
  }

  getDisplayTitle() {
    if (this.title) {
      return this.title;
    }

    // Format date as readable string
    const date = new Date(this.album_date + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  toJSON() {
    return {
      id: this.id,
      album_date: this.album_date,
      title: this.title,
      photo_count: this.photo_count,
      sort_order: this.sort_order,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromRow(row) {
    return new Album(row);
  }
}
