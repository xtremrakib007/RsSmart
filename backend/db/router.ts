class DatabaseRouter {
  private writer: Pool;
  private readers: Pool[];

  constructor() {
    this.writer = new Pool({ connectionString: process.env.DATABASE_URL });
    this.readers = [
      new Pool({ connectionString: process.env.DATABASE_REPLICA_URL_1 }),
    ];
  }

  getPool(operation: 'read' | 'write'): Pool {
    if (operation === 'write') return this.writer;
    const index = Math.floor(Math.random() * this.readers.length);
    return this.readers[index];
  }
}
