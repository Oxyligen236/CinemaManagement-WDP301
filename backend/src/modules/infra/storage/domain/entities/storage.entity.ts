import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('storages')
export class StorageObject {
  @PrimaryColumn({ type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 255 })
  originName!: string;

  @Column({ type: 'varchar', length: 255 })
  bucket!: string;

  @Column({ type: 'varchar', length: 100 })
  contentType!: string;

  @Column({ type: 'bigint', nullable: true })
  size?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  etag?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  get storageId(): string {
    return this.storageKey;
  }

  get key(): string {
    return this.storageKey;
  }

  static create(props: {
    storageKey: string;
    originName?: string;
    bucket: string;
    contentType?: string;
    size?: number;
    etag?: string;
  }): StorageObject {
    const storage = new StorageObject();
    storage.storageKey = props.storageKey;
    storage.originName = props.originName ?? '';
    storage.bucket = props.bucket;
    storage.contentType = props.contentType ?? 'application/octet-stream';
    storage.size = props.size;
    storage.etag = props.etag;
    return storage;
  }
}

export { StorageObject as StorageEntity };
