export class EntityError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'EntityError';
  }
}
