import { ExtendedResponse } from "./types.ts";

export async function apiRequest(
  method: string,
  url: string,
  body?: unknown,
  token?: string,
  customHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (customHeaders) Object.assign(headers, customHeaders);

  return await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export class ApiClient {
  constructor(private baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl}${path}`;
  }

  async get(path: string, token?: string, customHeaders?: Record<string, string>): Promise<ExtendedResponse> {
    const response = await apiRequest("GET", this.url(path), undefined, token, customHeaders) as ExtendedResponse;
    try {
      response.data = await response.clone().json();
    } catch {}
    return response;
  }

  async post(
    path: string,
    body?: unknown,
    token?: string,
    customHeaders?: Record<string, string>,
  ): Promise<ExtendedResponse> {
    const response = await apiRequest("POST", this.url(path), body, token, customHeaders) as ExtendedResponse;
    try {
      response.data = await response.clone().json();
    } catch {}
    return response;
  }

  async put(
    path: string,
    body?: unknown,
    token?: string,
    customHeaders?: Record<string, string>,
  ): Promise<ExtendedResponse> {
    const response = await apiRequest("PUT", this.url(path), body, token, customHeaders) as ExtendedResponse;
    try {
      response.data = await response.clone().json();
    } catch {}
    return response;
  }

  async delete(path: string, token?: string, customHeaders?: Record<string, string>): Promise<ExtendedResponse> {
    const response = await apiRequest("DELETE", this.url(path), undefined, token, customHeaders) as ExtendedResponse;
    try {
      response.data = await response.clone().json();
    } catch {}
    return response;
  }
}
