export class Photo {
  constructor(data) {
    this.id = data.id;
    this.album_id = data.album_id;
    this.filename = data.filename;
    this.file_size = data.file_size;
    this.mime_type = data.mime_type;
    this.photo_date = data.photo_date;
    this.upload_date = data.upload_date;
    this.photo_data_base64 = data.photo_data_base64;
    this.thumbnail_base64 = data.thumbnail_base64;
    this.exif_json = data.exif_json;
    this.is_favorite = data.is_favorite ?? 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.deleted_at = data.deleted_at;
  }

  validate() {
    // Validate required fields
    if (!this.album_id) {
      throw new Error('album_id is required');
    }

    if (!this.filename || this.filename.length > 255) {
      throw new Error('filename is required and must be max 255 characters');
    }

    if (!this.file_size || this.file_size <= 0) {
      throw new Error('file_size must be > 0');
    }

    if (!this.mime_type) {
      throw new Error('mime_type is required');
    }

    if (!this.photo_data_base64) {
      throw new Error('photo_data_base64 is required');
    }
  }

  getThumbnailUrl() {
    if (!this.thumbnail_base64) {
      return null;
    }

    if (this.thumbnail_base64.startsWith('data:')) {
      return this.thumbnail_base64;
    }

    return `data:image/jpeg;base64,${this.thumbnail_base64}`;
  }

  getPhotoUrl() {
    if (!this.photo_data_base64) {
      return null;
    }

    if (this.photo_data_base64.startsWith('data:')) {
      return this.photo_data_base64;
    }

    return `data:image/jpeg;base64,${this.photo_data_base64}`;
  }

  toJSON() {
    return {
      id: this.id,
      album_id: this.album_id,
      filename: this.filename,
      file_size: this.file_size,
      mime_type: this.mime_type,
      photo_date: this.photo_date,
      upload_date: this.upload_date,
      is_favorite: this.is_favorite,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromRow(row) {
    return new Photo(row);
  }
}
