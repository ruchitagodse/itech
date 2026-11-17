export class ServiceRequestError extends Error {
  constructor(code) { super(code); this.code = code; }
}
