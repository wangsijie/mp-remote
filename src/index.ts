import Taro from "@tarojs/taro";
import useSWROrigin from "swr";
import store from "./store";
import { pushLoading, popLoading } from "./loading";

let REMOTE_ROOT: string;

export function setRemoteRoot(root: string) {
  REMOTE_ROOT = root;
}

interface RequestOptions {
  url?: string;
  params?: { [key: string]: string };
  data?: { [key: string]: unknown };
  method?: "GET" | "POST" | "PUT" | "DELETE";
  spinner?: boolean;
  lazySpinner?: boolean;
  errorModal?: boolean;
}

export async function request<T>({
  url = "",
  params = {},
  data,
  method = "GET",
  spinner = true,
  lazySpinner = true,
  errorModal = true,
}: RequestOptions): Promise<T> {
  try {
    const noTokenPrefixes = ["/login"];
    const header: { [key: string]: any } = {};
    if (
      !noTokenPrefixes.reduce(
        (p, prefix) => p || url.indexOf(prefix) > -1,
        false
      )
    ) {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to get token");
      }
      header.Authorization = `bearer ${token}`;
    }
    Object.keys(params).forEach((key, index) => {
      const value = params[key];
      url += (index === 0 ? "?" : "&") + `${key}=${value}`;
    });
    if (spinner) {
      pushLoading(!lazySpinner);
    }
    const response = await Taro.request({
      url: `${REMOTE_ROOT}${url}`,
      dataType: "json",
      data,
      header,
      method,
    });
    if (spinner) {
      popLoading();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const message =
        response.statusCode === 404 && !response.data.message
          ? "未找到"
          : response.data.message;
      throw new Error(message);
    }
    return response.data;
  } catch (e) {
    if (spinner) {
      popLoading();
    }
    if (e instanceof Error && errorModal) {
      Taro.showModal({
        title: `错误`,
        content: e.message || "网络连接失败",
        showCancel: false,
        confirmText: "好",
      });
    }
    throw e;
  }
}

let logining: boolean = false;
export const login = async (): Promise<string> => {
  if (logining) {
    if (store.token) {
      return store.token;
    } else {
      return new Promise((resolve) => {
        setTimeout(() => login().then(resolve), 100);
      });
    }
  }
  logining = true;
  const { code } = await Taro.login();
  const data = await request<{ token: string; user: unknown }>({
    url: "/login",
    method: "POST",
    data: { code },
  });
  if (!data?.token) {
    throw new Error("Login error, missing `token` in response");
  } else {
    store.token = data.token;
    store.user = data.user;
    logining = false;
    return data.token;
  }
};

export const getToken = async () => {
  if (store.token) {
    return store.token;
  }
  const token = await login();
  if (!token) {
    // 抛出异常，阻止本次请求
    throw new Error("Unable to get token");
  }
  return token;
};

export const getUserInfo = () => store.user;

export const getUploadUrl = (url: string) => `${REMOTE_ROOT}${url}`;

export const uploadFile = async (endpoint: string, filePath: string) => {
  const url = getUploadUrl(endpoint);
  const token = await getToken();
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url,
      filePath,
      name: "file",
      header: {
        Authorization: `Bearer ${token}`,
      },
      success(response) {
        resolve(JSON.parse(response.data));
      },
      fail: reject,
    });
  });
};

export const uploadImage = async (endpoint: string) => {
  const filePaths: string[] = await new Promise((resolve, reject) => {
    Taro.chooseImage({
      success(res) {
        const tempFilePaths = res.tempFilePaths;
        resolve(tempFilePaths);
      },
      fail: reject,
    });
  });
  Taro.showToast({
    title: "正在上传",
    icon: "loading",
    duration: 60000,
  });
  const responses = [];
  for (const filePath of filePaths) {
    const response = await uploadFile(endpoint, filePath);
    responses.push(response);
  }
  Taro.hideToast();
  return responses;
};

export const useSWR = <T>(url: string) =>
  useSWROrigin<T>(url, (url) => request({ url }));
