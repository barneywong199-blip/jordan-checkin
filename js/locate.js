// GPS 定位（离线也能用：GPS 不需要网络）。多个页面共用同一个定位，最后一个使用者离开才关闭。

const listeners = new Set();
let watchId = null;
let last = null;

export const lastPosition = () => last;

function errorText(err) {
  if (!('geolocation' in navigator)) return '这个浏览器不支持定位。';
  if (err?.code === 1) {
    return '没有定位权限。请到 iPhone“设置 → 隐私与安全性 → 定位服务”，打开定位服务，并在“Safari 网站”里选“使用 App 期间”；Mac 请在浏览器网址栏左边的设置里允许位置。';
  }
  if (err?.code === 3) return '定位超时，请到空旷的地方再试一次。';
  return '暂时无法取得位置，请稍后再试。';
}

// 返回一个函数，调用即停止接收
export function watchMe({ onPosition, onError }) {
  const l = { onPosition, onError };
  listeners.add(l);
  if (last) setTimeout(() => onPosition(last), 0);
  if (!('geolocation' in navigator)) {
    setTimeout(() => onError(errorText()), 0);
    return () => listeners.delete(l);
  }
  if (watchId === null) {
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        last = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
        for (const x of listeners) x.onPosition(last);
      },
      (err) => {
        for (const x of listeners) x.onError(errorText(err), err);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}
