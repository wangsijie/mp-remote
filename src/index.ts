import Taro from '@tarojs/taro';
import store from './store';
import { pushLoading, popLoading } from './loading';

let REMOTE_ROOT: string;

export function setRemoteRoot(root: string) {
  REMOTE_ROOT = root;
}

interface RequestOptions {
  endpoint?: string;
  query?: { [key: string]: any };
  data?: { [key: string]: any };
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  throwException?: boolean | 'show-message';
  loading?: boolean;
  instantLoading?: boolean;
}

export async function request({
  endpoint = '',
  query = {},
  data,
  method = 'GET',
  throwException = false,
  loading = true,
  instantLoading = false
}: RequestOptions) {
  try {
    let url = `${REMOTE_ROOT}${endpoint}`;
    const noTokenPrefixes = [
      '/users/login',
    ];
    const header: { [key: string]: any } = {};
    if (!noTokenPrefixes.reduce((p, prefix) => p || endpoint.indexOf(prefix) > -1, false)) {
      header.Authorization = `bearer ${await getToken()}`;
    }
    Object.keys(query).forEach((key, index) => {
      const value = query[key];
      url += (index === 0 ? '?' : '&') + `${key}=${value}`;
    });
    if (loading) {
      pushLoading(instantLoading);
    }
    const response = await Taro.request({
      url,
      dataType: 'json',
      data,
      header,
      method
    });
    if (loading) {
      popLoading();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      let message = response.data.message;
      if (!message && response.statusCode === 404) {
        message = '未找到';
      }
      throw new Error(message);
    }
    return response.data;
  } catch (e) {
    if (loading) {
      popLoading();
    }
    if (throwException === true) {
      throw e;
    } else if (throwException === 'show-message') {
      Taro.showModal({
        title: `错误`,
        content: e.message,
        showCancel: false,
        confirmText: '好'
      });
      throw e;
    } else {
      Taro.showModal({
          title: `错误`,
          content: e.message || '网络连接失败',
          showCancel: false,
          confirmText: '好'
      });
    }
  }
}

export function $get(endpoint: string, query = {}, options: RequestOptions = {}) {
  options.endpoint = endpoint;
  options.query = query;
  options.method = 'GET';
  return request(options);
}
export function $post(endpoint: string, data = {}, options: RequestOptions = {}) {
  options.endpoint = endpoint;
  options.data = data;
  options.method = 'POST';
  return request(options);
}
export function $put(endpoint: string, data = {}, options: RequestOptions = {}) {
  options.endpoint = endpoint;
  options.data = data;
  options.method = 'PUT';
  return request(options);
}
export function $delete(endpoint: string, data = {}, options: RequestOptions = {}) {
  options.endpoint = endpoint;
  options.data = data;
  options.method = 'DELETE';
  return request(options);
}

let logining: boolean = false
export const login = async (): Promise<string | null> => {
  if (logining) {
    if (store.token) {
      return store.token;
    } else {
      return new Promise((resolve) => {
        setTimeout(() => login().then(resolve), 100);
      })
    }
  }
  logining = true;
  const { code } = await Taro.login();
  const res = await $post('/users/login', { code });
  if (!res || !res.token) {
    return null;
  } else {
    store.token = res.token;
    logining = false;
    return res.token;
  }
}

export const getToken = async () => {
  if (store.token) {
    return store.token;
  }
  const token = await login();
  if (!token) {
    // 抛出异常，阻止本次请求
    throw new Error();
  }
  return token;
}

export const getUploadUrl = async (url: string) => `${REMOTE_ROOT}${url}`;
export const getUploadUrlSync = (url: string) => `${REMOTE_ROOT}${url}`;

export const uploadFile = async (endpoint: string, filePath: string) => {
  const url = await getUploadUrl(endpoint);
  const token = await getToken();
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success(response) {
        resolve(JSON.parse(response.data))
      },
      fail: reject
    });
  })
}

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
    title: '正在上传',
    icon: 'loading',
    duration: 60000
  });
  const responses = [];
  for (const filePath of filePaths) {
    const response = await uploadFile(endpoint, filePath);
    responses.push(response);
  }
  Taro.hideToast();
  return responses;
}
