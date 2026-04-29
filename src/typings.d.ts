// 鍏ㄥ眬瑕佺敤鐨勭被鍨嬫斁鍒拌繖閲?

declare global {
  interface IResData<T> {
    code: number
    msg: string
    data: T
  }

  // uni.uploadFile鏂囦欢涓婁紶鍙傛暟
  interface IUniUploadFileOptions {
    file?: File
    files?: UniApp.UploadFileOptionFiles[]
    filePath?: string
    name?: string
    formData?: any
  }

  interface IUserInfo {
    nickname?: string
    avatar?: string
    /** 寰俊鐨?openid锛岄潪寰俊娌℃湁杩欎釜瀛楁 */
    openid?: string
  }

  interface IUserToken {
    token: string
    refreshToken?: string
    refreshExpire?: number
  }
}

// 鎵╁睍 @uni-helper/vite-plugin-uni-pages 鐨?definePage 鍙傛暟绫诲瀷
declare module '@uni-helper/vite-plugin-uni-pages' {
  interface UserPageMeta {
    /**
     * 浣跨敤 type: "home" 灞炴€ц缃椤碉紝鍏朵粬椤甸潰涓嶉渶瑕佽缃紝榛樿涓簆age
     *
     * 灏介噺淇濊瘉涓€涓」鐩?鍙湁涓€涓?杩欎釜閰嶇疆锛屽鏋滄湁澶氫釜锛屼細鎸夌収瀛楁瘝椤哄簭鏉ユ帓鍒楋紝鏈€缁堝彲鑳戒笉鏄偍鎯宠鐨勬晥鏋溿€?
     */
    type?: 'home'
    /**
     * 椤甸潰甯冨眬绫诲瀷, 妯℃澘榛樿鍙湁 default, 濡傛灉鍦?src/layouts 涓嬫柊澧炰簡 layout, 鍙互鎵╁睍褰撳墠灞炴€?
     * @default 'default'
     *
     * 褰撳墠灞炴€т緵 https://github.com/uni-helper/vite-plugin-uni-layouts 鎻掍欢浣跨敤
     */
    layout?: 'default' | false
    /**
     * 鏄惁浠庨渶瑕佺櫥褰曠殑璺緞涓帓闄?
     *
     * 鐧诲綍鎺堟潈(鍙€?锛氳窡浠ュ墠鐨?needLogin 绫讳技鍔熻兘锛屼絾鏄悓鏃舵敮鎸侀粦鐧藉悕鍗曪紝璇︽儏璇疯 src/router 鏂囦欢澶?
     */
    excludeLoginPath?: boolean
  }
}


// patch uni 绫诲瀷
// 1. 琛ュ叏 uni.hideToast() 鐨?options 绫诲瀷
// 2. 琛ュ叏 uni.hideLoading() 鐨?options 绫诲瀷
// 3. 浣跨敤鏂瑰紡瑙侊細https://github.com/unibest-tech/unibest/pull/241
declare global {
  declare namespace UniNamespace {
    /** 鎺ュ彛璋冪敤缁撴潫鐨勫洖璋冨嚱鏁帮紙璋冪敤鎴愬姛銆佸け璐ラ兘浼氭墽琛岋級 */
    type HideLoadingCompleteCallback = (res: GeneralCallbackResult) => void
    /** 鎺ュ彛璋冪敤澶辫触鐨勫洖璋冨嚱鏁?*/
    type HideLoadingFailCallback = (res: GeneralCallbackResult) => void
    /** 鎺ュ彛璋冪敤鎴愬姛鐨勫洖璋冨嚱鏁?*/
    type HideLoadingSuccessCallback = (res: GeneralCallbackResult) => void

    interface HideLoadingOption {
      /** 鎺ュ彛璋冪敤缁撴潫鐨勫洖璋冨嚱鏁帮紙璋冪敤鎴愬姛銆佸け璐ラ兘浼氭墽琛岋級 */
      complete?: HideLoadingCompleteCallback
      /** 鎺ュ彛璋冪敤澶辫触鐨勫洖璋冨嚱鏁?*/
      fail?: HideLoadingFailCallback
      test: UniNamespace.GeneralCallbackResult
      /**
       * 寰俊灏忕▼搴忥細闇€瑕佸熀纭€搴擄細 `2.22.1`
       *
       * 寰俊灏忕▼搴忥細鐩墠 toast 鍜?loading 鐩稿叧鎺ュ彛鍙互鐩镐簰娣风敤锛屾鍙傛暟鍙敤浜庡彇娑堟贩鐢ㄧ壒鎬?
       */
      noConflict?: boolean
      /** 鎺ュ彛璋冪敤鎴愬姛鐨勫洖璋冨嚱鏁?*/
      success?: HideLoadingSuccessCallback
    }

    // ----------------------------------------------------------

    /** 鎺ュ彛璋冪敤缁撴潫鐨勫洖璋冨嚱鏁帮紙璋冪敤鎴愬姛銆佸け璐ラ兘浼氭墽琛岋級 */
    type HideToastCompleteCallback = (res: GeneralCallbackResult) => void
    /** 鎺ュ彛璋冪敤澶辫触鐨勫洖璋冨嚱鏁?*/
    type HideToastFailCallback = (res: GeneralCallbackResult) => void
    /** 鎺ュ彛璋冪敤鎴愬姛鐨勫洖璋冨嚱鏁?*/
    type HideToastSuccessCallback = (res: GeneralCallbackResult) => void
    interface HideToastOption {
      /** 鎺ュ彛璋冪敤缁撴潫鐨勫洖璋冨嚱鏁帮紙璋冪敤鎴愬姛銆佸け璐ラ兘浼氭墽琛岋級 */
      complete?: HideToastCompleteCallback
      /** 鎺ュ彛璋冪敤澶辫触鐨勫洖璋冨嚱鏁?*/
      fail?: HideToastFailCallback
      /**
       * 寰俊灏忕▼搴忥細闇€瑕佸熀纭€搴擄細 `2.22.1`
       *
       * 寰俊灏忕▼搴忥細鐩墠 toast 鍜?loading 鐩稿叧鎺ュ彛鍙互鐩镐簰娣风敤锛屾鍙傛暟鍙敤浜庡彇娑堟贩鐢ㄧ壒鎬?
       */
      noConflict?: boolean
      /** 鎺ュ彛璋冪敤鎴愬姛鐨勫洖璋冨嚱鏁?*/
      success?: HideToastSuccessCallback
    }
  }
  interface Uni {
    /**
     * 闅愯棌 loading 鎻愮ず妗?
     *
     * 鏂囨。: [http://uniapp.dcloud.io/api/ui/prompt?id=hideloading](http://uniapp.dcloud.io/api/ui/prompt?id=hideloading)
     * @example ```typescript
     * uni.showLoading({
     *   title: '鍔犺浇涓?
     * });
     *
     * setTimeout(function () {
     *   uni.hideLoading();
     * }, 2000);
     *
     * ```
     * @tutorial [](https://uniapp.dcloud.net.cn/api/ui/prompt.html#hideloading)
     * @uniPlatform {
     * "app": {
     * "android": {
     * "osVer": "4.4.4",
     * "uniVer": "鈭?,
     * "unixVer": "3.9.0"
     * },
     * "ios": {
     * "osVer": "9.0",
     * "uniVer": "鈭?,
     * "unixVer": "3.9.0"
     * }
     * }
     * }
     */
    // eslint-disable-next-line ts/method-signature-style
    hideLoading<T extends UniNamespace.HideToastOption = UniNamespace.HideToastOption>(options?: T): void
    /**
     * 闅愯棌娑堟伅鎻愮ず妗?
     *
     * 鏂囨。: [http://uniapp.dcloud.io/api/ui/prompt?id=hidetoast](http://uniapp.dcloud.io/api/ui/prompt?id=hidetoast)
     * @example ```typescript
     *    uni.hideToast();
     * ```
     * @tutorial [](https://uniapp.dcloud.net.cn/api/ui/prompt.html#hidetoast)
     * @uniPlatform {
     * "app": {
     * "android": {
     * "osVer": "4.4.4",
     * "uniVer": "鈭?,
     * "unixVer": "3.9.0"
     * },
     * "ios": {
     * "osVer": "9.0",
     * "uniVer": "鈭?,
     * "unixVer": "3.9.0"
     * }
     * }
     * }
     */
    // eslint-disable-next-line ts/method-signature-style
    hideToast<T extends UniNamespace.HideLoadingOption = UniNamespace.HideLoadingOption>(options?: T): void
  }
}

export {} // 闃叉妯″潡姹℃煋
