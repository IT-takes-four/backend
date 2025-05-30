import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

const baseURL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3030")
    : (process.env.API_URL ?? "http://localhost:3030");

const AXIOS_INSTANCE = axios.create({
  baseURL,
  withCredentials: true,
});

export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  return AXIOS_INSTANCE({
    ...config,
    ...options,
  });
};
