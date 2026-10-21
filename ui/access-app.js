import { createApp, h, ref } from "vue";
import { ElConfigProvider, ElButton, ElAlert, ElEmpty } from "element-plus";
import zhTw from "element-plus/es/locale/lang/zh-tw";
import "element-plus/dist/index.css";
import "./element-app.css";
import "./access-app.css";

const STORAGE = "payment-system-management-v2";
const {
  SystemManagement: Management,
  seed,
  migrate,
  isSavedData,
} = window.SystemManagement;
const choosingStore = location.pathname.endsWith("/select-store.html");

createApp({
  setup() {
    const error = ref("");
    const busy = ref(false);
    let model;
    let saved;
    function load() {
      const raw = localStorage.getItem(STORAGE) ?? localStorage.getItem("payment-system-demo-v1");
      saved = raw == null ? null : JSON.parse(raw);
      if (raw != null && !isSavedData(saved?.data))
        throw Error("無法讀取商店資料，請確認瀏覽器儲存資料後重試。");
      model = new Management(
        migrate(saved?.data || seed()),
        saved ? (saved.currentUserId ?? "invalid") : "admin",
        saved?.store,
      );
    }
    if (choosingStore) {
      try {
        load();
      } catch (issue) {
        error.value = issue.message;
      }
    }
    function login() {
      // Demonstration only: a click succeeds without OAuth, credentials or a token.
      location.assign("select-store.html");
    }
    function selectStore(id) {
      if (busy.value) return;
      busy.value = true;
      try {
        // Re-read before saving so changes in another tab are not overwritten.
        load();
        model.switchStore(id);
        localStorage.setItem(
          STORAGE,
          JSON.stringify({
            ...saved,
            data: model.data,
            currentUserId: model.identity,
            store: model.store,
          }),
        );
        location.assign("index.html");
      } catch (issue) {
        error.value = issue.message || "無法儲存所選商店，請重試。";
        busy.value = false;
      }
    }
    return () =>
      h(ElConfigProvider, { locale: zhTw, size: "large" }, () =>
        choosingStore
          ? h("main", { class: "store-selection" }, [
              h(
                "section",
                {
                  class: "store-selection-panel",
                  "aria-labelledby": "store-title",
                },
                [
                  h("h1", { id: "store-title" }, "請選擇商店"),
                  error.value
                    ? h(ElAlert, {
                        class: "platform-access-alert",
                        title: error.value,
                        type: "error",
                        showIcon: true,
                        closable: false,
                      })
                    : null,
                  model?.stores().length
                    ? h(
                        "nav",
                        {
                          class: "store-selection-list",
                          "aria-label": "可選商店",
                        },
                        model.stores().map((store) =>
                          h(
                            ElButton,
                            {
                              key: store.id,
                              size: "large",
                              type: "primary",
                              round: true,
                              disabled: busy.value,
                              onClick: () => selectStore(store.id),
                            },
                            () => store.name,
                          ),
                        ),
                      )
                    : !error.value
                      ? h(ElEmpty, {
                          description: "目前沒有可選擇的商店",
                          imageSize: 64,
                        })
                      : null,
                ],
              ),
            ])
          : h("main", { class: "login-screen" }, [
              h("div", { class: "login-content" }, [
                h("h1", "行動支付支援平台"),
                h(ElButton, { size: "large", class: "google-login", onClick: login }, () => [
                  h("img", {
                    src: "assets/google.svg",
                    alt: "",
                    width: 18,
                    height: 18,
                  }),
                  h("span", "使用 Google 帳戶登入"),
                ]),
              ]),
            ]),
      );
  },
}).mount("#access-app");
