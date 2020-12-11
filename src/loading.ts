import Taro from '@tarojs/taro';

let loadingCount: number = 0;
let loadingTimer: number;

export function pushLoading(instantLoading?: boolean): void {
  if (loadingCount === 0) {
    loadingTimer = setTimeout(() => {
      if (loadingCount > 0) {
        Taro.showToast({
          title: '正在加载',
          icon: 'loading',
          duration: 60000
        });
      }
    }, instantLoading ? 0 : 500);
  }
  loadingCount++;
}

export function popLoading(): void {
  loadingCount--;
  if (loadingCount === 0) {
    Taro.hideToast();
    clearTimeout(loadingTimer);
  }
}
