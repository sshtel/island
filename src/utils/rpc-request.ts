export interface RpcSchemaOptions {
  query?: {
    sanitization: any;
    validation: any;
  };
  result?: {
    sanitization: any;
    validation: any;
  };
}

export interface RpcOptions {
  version?: string;
  schema?: RpcSchemaOptions;
  developmentOnly?: boolean;
}

export interface RpcRequest {
  name: string;
  msg: any;
  options: RpcOptions;
}
