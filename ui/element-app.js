import { createApp, h, ref, nextTick, Teleport } from "vue";
import {
  ElConfigProvider,
  ElContainer,
  ElAside,
  ElHeader,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElSubMenu,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElAvatar,
  ElButton,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElCheckbox,
  ElRadio,
  ElSwitch,
  ElDatePicker,
  ElTimePicker,
  ElForm,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElDialog,
  ElTag,
  ElAlert,
  ElEmpty,
  ElCollapse,
  ElCollapseItem,
  ElTooltip,
  ElDescriptions,
  ElDescriptionsItem,
  ElMessage,
  ElTabs,
  ElTabPane,
} from "element-plus";
import zhTw from "element-plus/es/locale/lang/zh-tw";
import {
  House,
  Document,
  Goods,
  DataAnalysis,
  Setting,
  Fold,
  Expand,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Close,
  Calendar,
  Clock,
  Edit,
  Search,
  Plus,
  Delete,
} from "@element-plus/icons-vue";
import "element-plus/dist/index.css";
import "./element-app.css";
import { pageFeature, permitted, controlPermitted } from "./permissions.js";

/**
 * Compatibility boundary: the existing controllers remain the source of business
 * state. Only Element Plus renders the visible application. Source controls stay
 * connected for FormData, validity, delegated events, and existing references.
 * No selectors/classes from the controller DOM are copied to the Vue view.
 */
const version = ref(0);
const collapsed = ref(innerWidth < 768);
const viewportWidth = ref(innerWidth);
window.addEventListener("resize", () => {
  if (innerWidth < 768 !== viewportWidth.value < 768)
    collapsed.value = innerWidth < 768;
  viewportWidth.value = innerWidth;
});
const source = document.createElement("div");
source.id = "controller-source";
source.hidden = true;
source.setAttribute("aria-hidden", "true");
const originalChildren = [...document.body.childNodes];
document.body.prepend(source);
originalChildren.forEach((node) => {
  if (
    node.nodeType !== Node.ELEMENT_NODE ||
    !["SCRIPT", "STYLE"].includes(node.tagName)
  )
    source.append(node);
});
document.querySelectorAll("link[rel=stylesheet]").forEach((link) => {
  if (!link.href.includes("/ui/")) link.disabled = true;
});
document.body.classList.add("element-platform");
const mount = document.createElement("div");
mount.id = "element-app";
document.body.append(mount);

const identities = new WeakMap();
const viewRefs = new WeakMap();
const localPage = new WeakMap();
const tablePages = new WeakMap();
const cellPositions = new WeakMap();
let identity = 0,
  scheduled = false;
const keyFor = (node) => {
  if (!identities.has(node)) identities.set(node, ++identity);
  return identities.get(node);
};
function refresh() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    version.value++;
  });
}
function emit(node, type) {
  node.dispatchEvent(new Event(type, { bubbles: true }));
  refresh();
}
function setValue(node, value, change = true) {
  node.value = value ?? "";
  emit(node, "input");
  if (change && node.isConnected) emit(node, "change");
}
function activate(node, event) {
  event?.preventDefault?.();
  if (node.disabled || !controlPermitted(node)) return;
  node.click();
  refresh();
}
const originalFocus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (...args) {
  if (!source.contains(this)) return originalFocus.apply(this, args);
  const focus = () => {
    const target = viewRefs.get(this);
    if (target?.focus) target.focus();
    else if (target?.$el)
      target.$el.querySelector("input,button,[tabindex]")?.focus();
    else if (target instanceof HTMLElement) originalFocus.call(target);
  };
  queueMicrotask(() => nextTick(focus));
};
const returnFocus = new WeakMap();
HTMLDialogElement.prototype.showModal = function () {
  returnFocus.set(this, document.activeElement);
  this.setAttribute("open", "");
  refresh();
};
HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.close = function (value = "") {
  this.returnValue = value;
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
  refresh();
  nextTick(() => returnFocus.get(this)?.focus?.());
};
function cancelDialog(dialog) {
  if (dialog.dispatchEvent(new Event("cancel", { cancelable: true })))
    dialog.close();
  refresh();
}
// Property writes (unlike attribute writes) aren't delivered by MutationObserver.
for (const [prototype, properties] of [
  [HTMLInputElement.prototype, ["value", "checked", "indeterminate"]],
  [HTMLSelectElement.prototype, ["value", "selectedIndex"]],
  [HTMLTextAreaElement.prototype, ["value"]],
])
  for (const property of properties) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.set) continue;
    Object.defineProperty(prototype, property, {
      ...descriptor,
      set(value) {
        descriptor.set.call(this, value);
        if (source.contains(this)) refresh();
      },
    });
  }
new MutationObserver(refresh).observe(source, {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
});
new MutationObserver((records) => {
  for (const record of records)
    for (const node of record.addedNodes) {
      if (
        node.nodeType === 1 &&
        node.matches("dialog,#sys-feedback,.refund-notice")
      )
        source.append(node);
    }
}).observe(document.body, { childList: true });
source.addEventListener("reset", () => setTimeout(refresh));

const icons = {
  house: House,
  "file-text": Document,
  bag: Goods,
  briefcase: DataAnalysis,
  gear: Setting,
  list: Fold,
  pencil: Edit,
  x: Close,
  calendar3: Calendar,
  clock: Clock,
  "chevron-left": ArrowLeft,
  "chevron-right": ArrowRight,
  "chevron-down": ArrowDown,
};
const icon = (component) => h(ElIcon, null, () => h(component));
function modalFieldLabel(node) {
  if (!node.closest("dialog") || !node.matches("label,span") || node.querySelector("input,select,textarea,button")) return null;
  const parent = node.parentElement;
  const row = parent?.matches("label,.product-form-row,.role-setting-row,.statement-form-row,.user-create-row,.payment-method-field,.payment-invoice-field,.store-fee-settings-row") && parent.firstElementChild === node;
  const associated = node.matches("label[for]") && source.querySelector(`#${CSS.escape(node.htmlFor)}`);
  if (!row && !associated && !node.matches(".product-form-label,.role-setting-label,.statement-label,.store-fee-settings-label")) return null;
  const controls = associated ? [associated] : [...parent.querySelectorAll("input,select,textarea")];
  return {
    required: node.classList.contains("required") || /[*＊]/.test(node.textContent) || controls.some(control => control.required) || parent.classList.contains("user-grants-row"),
    text: node.textContent.replace(/[*＊]/g, "").trim(),
  };
}
function classNames(node) {
  return [...node.classList].map((name) => "ep-" + name);
}
function propsFor(node) {
  return {
    key: keyFor(node),
    class: classNames(node),
    "data-source-id": node.id || undefined,
    id: node.id ? `view-${node.id}` : undefined,
    "aria-label": node.getAttribute("aria-label") || undefined,
    title: node.getAttribute("title") || undefined,
    "aria-describedby": node
      .getAttribute("aria-describedby")
      ?.split(/\s+/)
      .map((id) => `view-${id}`)
      .join(" "),
    "data-ui-tag": node.tagName.toLowerCase(),
    ref: (value) => {
      if (value) viewRefs.set(node, value);
    },
  };
}
function controlLabel(node) {
  return (
    node.getAttribute("aria-label") ||
    (node.id &&
      source
        .querySelector(`label[for="${CSS.escape(node.id)}"]`)
        ?.textContent.trim()) ||
    node.closest("label")?.textContent.trim() ||
    node.placeholder ||
    node.name ||
    undefined
  );
}
function children(node, exclude = () => false) {
  return [...node.childNodes]
    .filter((child) => !exclude(child))
    .map(renderNode)
    .filter((value) => value != null);
}
function isListActions(node) {
  return node?.matches(
    'button.success, .tag-list-toolbar, [class$="-list-toolbar"]',
  );
}
function columnSizing(title, table) {
  if (table?.classList.contains("refund-table")) {
    return { minWidth: ({"商店訂單編號":190,"商品名稱":180,"訂單金額":110,"發票號碼":140,"發票金額":110,"退款金額":130,"發票處理":120})[title] || 120 };
  }
  if (table?.closest(".project-management-table")) {
    return ({
      商店: { width: 150 },
      專案名稱: { width: 190 },
      狀態: { width: 80 },
      目前啟用支付工具: { minWidth: 360 },
      功能: { width: 240 },
    })[title] || { minWidth: 140 };
  }
  if (table?.closest("#store-fee-modal-form")) {
    return { minWidth: ({"支付工具":180,"費率來源":150,"啟用":80,"手續費率":200})[title] || 140 };
  }
  if (table?.closest(".role-permission-table")) {
    return title === "功能" ? { width: innerWidth < 768 ? 110 : 150 } : { minWidth: 160 };
  }
  if (table?.closest(".order-history")) {
    return title === "日期" ? { width: 250 } : { minWidth: 280 };
  }
  if (table?.closest(".store-fee-versions-table")) {
    const sizing = { ID: {width:72}, 設定狀態:{width:100}, 費率生效狀態:{width:140}, 手續費開始時間:{minWidth:210}, 手續費結束時間:{minWidth:210}, 設定時間:{minWidth:210}, 功能:{width:190} };
    if (sizing[title]) return sizing[title];
  }
  if (table?.closest(".product-table")) {
    const sizing = {
      上架開始時間: { width: 132 },
      上架結束時間: { width: 132 },
      功能: { width: 316 },
    };
    if (sizing[title]) return sizing[title];
  }
  if (table?.closest(".statement-table")) {
    const sizing = {
      商店: { minWidth: 200 },
      專案: { minWidth: 240 },
      查詢區間: { width: 220, className: "statement-single-line" },
      封存時間: { width: 184, className: "statement-single-line" },
      報表: { width: 136, className: "statement-report-action" },
      備註: { width: 120 },
    };
    if (sizing[title]) return sizing[title];
  }
  if (table?.closest(".store-management-table")) {
    const sizing = {
      商店名稱: { width: 180 },
      狀態: { width: 88 },
      目前啟用支付工具: { minWidth: 420 },
      功能: { width: 280 },
    };
    if (sizing[title]) return sizing[title];
  }
  if (table?.closest(".payment-table")) {
    const sizing = {
      第三方金流平台: { width: 160 },
      支付工具: { minWidth: 280 },
      "手續費（含稅）": { width: 160 },
      幣別: { width: 100 },
      "手續費開始時間 (GMT+8)": { minWidth: 230 },
      狀態: { width: 120 },
    };
    if (sizing[title]) return sizing[title];
  }
  if (table?.closest(".fee-settings-table")) {
    return {
      minWidth:
        {
          支付工具: 220,
          設定方式: 170,
          目前費率: 150,
          上層費率: 150,
          自訂費率: 200,
          預計套用費率: 180,
        }[title] || 160,
    };
  }
  if (table?.closest(".fee-history-table")) {
    return {
      minWidth:
        {
          "生效期間（台北時間）": 230,
          狀態: 100,
          "設定人／設定時間": 220,
          功能: 280,
        }[title] || 160,
    };
  }
  const headers = [...(table?.tHead?.rows[0]?.cells || [])].map((cell) =>
    cell.textContent.trim(),
  );
  if (headers[0] === "姓名" && headers[1] === "Email 帳號") {
    const sizing = {
      姓名: { width: 120 },
      "Email 帳號": { minWidth: 260 },
      商店: { minWidth: 190 },
      專案: { minWidth: 230 },
      角色: { width: 150 },
      狀態: { width: 88 },
    };
    if (sizing[title]) return sizing[title];
  }
  if (/^(ID|編號|序號)$/i.test(title)) return { width: 72 };
  if (/訂單編號/.test(title)) return { width: 172 };
  if (/發票(編號|號碼)/.test(title)) return { width: 140 };
  return {
    minWidth: /功能|操作/.test(title)
      ? 240
      : /時間|日期|編號|網址|備註|說明/.test(title)
        ? 190
        : /名稱|商品|平台|方式/.test(title)
          ? 180
          : 120,
  };
}
const validationTouched = new WeakSet();
source.addEventListener("invalid", event => {
  event.preventDefault();
  validationTouched.add(event.target);
  refresh();
}, true);
function nativeFieldError(node) {
  if (node.disabled || !node.willValidate) return "";
  const label = (controlLabel(node) || "此欄位").replace(/[*＊]/g, "").trim();
  const state = node.validity;
  if (state.customError) return node.validationMessage;
  if (state.valueMissing || (node.required && !node.value.trim())) return `${node.tagName === "SELECT" || ["checkbox","radio"].includes(node.type) ? "請選擇" : "請輸入"}${label}`;
  if (state.typeMismatch) return node.type === "email" ? "請輸入有效的電子郵件地址" : "請輸入有效的網址（http 或 https）";
  if (state.rangeUnderflow) return `數值不可小於 ${node.min}`;
  if (state.rangeOverflow) return `數值不可大於 ${node.max}`;
  if (state.badInput) return "請輸入有效的數字";
  if (state.patternMismatch) return "輸入格式不正確，請確認後重新輸入";
  if (state.tooShort) return `至少輸入 ${node.minLength} 個字元`;
  if (state.stepMismatch) return "請輸入符合允許間距的數值";
  return "";
}
function validationTarget(alert) {
  const message = alert.textContent.trim();
  if (!message || alert.hidden || alert.id === "sys-feedback" || alert.classList.contains("refund-notice")) return null;
  const scope = alert.closest("form") || alert.closest("dialog");
  if (!scope) return null;
  const controls = [...scope.querySelectorAll("input,select,textarea")].filter(n => !n.disabled && n.type !== "hidden");
  const invalid = controls.find(n => nativeFieldError(n));
  if (invalid) return invalid;
  const rules = [
    [/結束|晚於|早於|起訖/, /endsAt|end/i],
    [/開始時間|生效時間/, /effectiveAt|start/i],
    [/網址|返回頁|http/i, /url|return/i],
    [/商店 ID|代碼/, /storeId|code/i],
    [/郵件|信箱|Gmail|email/i, /email|login/i],
    [/退款金額/, /amount/i],
    [/名稱|姓名/, /name/i],
    [/費率/, /fee-|rate/i],
    [/付款方式/, /checkbox/i],
    [/專案|授權/, /project/i],
  ];
  for (const [words, field] of rules) if (words.test(message)) {
    const match = controls.find(n => field.test(`${n.name} ${n.id} ${n.type}`));
    if (match) return match;
  }
  return null;
}
function fieldError(node) {
  const scope = node.form || node.closest("dialog");
  if (node.form?.id === "user-create-form") {
    if (node.form.dataset.validationSubmitted !== "true") return "";
    const alert = [...scope.querySelectorAll('[role="alert"]')].find(a => validationTarget(a) === node);
    return node.dataset.validationError || nativeFieldError(node) || alert?.textContent.trim() || "";
  }
  if (["new-product-form", "statement-form"].includes(node.form?.id)) {
    return node.form.dataset.validationSubmitted === "true" ? nativeFieldError(node) : "";
  }
  const alert = scope && [...scope.querySelectorAll('[role="alert"]')].find(a => validationTarget(a) === node);
  return (validationTouched.has(node) ? nativeFieldError(node) : "") || (alert?.textContent.trim() || "");
}
function renderField(node, control) {
  if (!control || node.hidden || node.type === "hidden") return control;
  const error = fieldError(node);
  if (["checkbox","radio"].includes(node.type) && !error) return control;
  const id = `field-error-${keyFor(node)}`;
  return h("div", {class:["platform-field", {"is-invalid":!!error}], "data-field-name":node.name || node.id}, [
    control,
    error ? h("div", {id, class:"platform-field-error", role:"status"}, error) : null,
  ]);
}
function renderSelect(node) { return renderField(node, renderSelectControl(node)); }
function renderInput(node, visibleLabel) { return renderField(node, renderInputControl(node, visibleLabel)); }
function renderSelectControl(node) {
  const props = {...propsFor(node), "aria-invalid":!!fieldError(node), "aria-describedby":fieldError(node) ? `field-error-${keyFor(node)}` : undefined, onBlur:() => {validationTouched.add(node);refresh();}};
  return h(
    ElSelect,
    {
      ...props,
      modelValue: node.multiple
        ? [...node.selectedOptions].map((option) => option.value)
        : node.value,
      multiple: node.multiple,
      disabled: node.disabled,
      filterable: node.options.length > 6,
      "aria-label": controlLabel(node),
      placeholder: node.options[0]?.textContent,
      "onUpdate:modelValue": (value) => {
        if (node.multiple) {
          [...node.options].forEach((option) => {
            option.selected = value.includes(option.value);
          });
          emit(node, "change");
        } else setValue(node, value);
      },
    },
    () =>
      [...node.options].map((option) =>
        h(ElOption, {
          key: option.value,
          value: option.value,
          label: option.textContent,
          disabled: option.disabled,
        }),
      ),
  );
}
function renderInputControl(node, visibleLabel) {
  const props = {
    "aria-invalid":!!fieldError(node),
    onBlur:() => {validationTouched.add(node);refresh();},
    ...propsFor(node),
    "aria-label": controlLabel(node),
    disabled: node.disabled,
    "aria-describedby":fieldError(node) ? `field-error-${keyFor(node)}` : undefined,
  };
  if (node.type === "hidden" || node.hidden) return null;
  if (node.type === "checkbox" && node.hasAttribute("data-switch")) {
    return h("div", {class:"store-status-control"}, [visibleLabel ? h("span", {class:"store-status-label"}, visibleLabel) : null, h(ElSwitch, {...props, ...(node.closest(".store-fee-modal-table") ? {size:"default"} : {}), modelValue:node.checked, "onUpdate:modelValue": value => {node.checked = value; emit(node,"change");}})]);
  }

  if (node.type === "checkbox" || node.type === "radio") {
    const checkbox = node.type === "checkbox";
    return h(
      checkbox ? ElCheckbox : ElRadio,
      {
        ...props,
        ariaLabel: controlLabel(node),
        modelValue: checkbox ? node.checked : node.checked ? node.value : null,
        name: node.name
          ? `ui-${keyFor(node.form || node.parentElement)}-${node.name}`
          : undefined,
        value: node.value,
        indeterminate: node.indeterminate,
        "onUpdate:modelValue": (value) => {
          node.checked = checkbox ? !!value : true;
          emit(node, "input");
          emit(node, "change");
        },
      },
      () => visibleLabel || "",
    );
  }
  const isDate =
    node.type === "date" ||
    node.type === "datetime-local" ||
    node.classList.contains("product-date") ||
    /日期|支付時間/.test(node.placeholder || "");
  const range = /至/.test(node.placeholder || "");
  if (isDate || range) {
    const datetime =
      node.type === "datetime-local" || node.classList.contains("product-date");
    return h(ElDatePicker, {
      ...props,
      modelValue: range
        ? node.dataset.dateRange
          ? JSON.parse(node.dataset.dateRange)
          : null
        : node.type === "datetime-local" && node.value.length === 16 ? `${node.value}:00` : node.value || null,
      type: range ? "daterange" : datetime ? "datetime" : "date",
      editable: !node.disabled && !node.readOnly,
      format: range ? "YYYY-MM-DD" : datetime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD",
      valueFormat: datetime
        ? node.type === "datetime-local"
          ? "YYYY-MM-DDTHH:mm:ss"
          : "YYYY-MM-DD HH:mm:ss"
        : "YYYY-MM-DD",
      placeholder: range ? undefined : node.placeholder || "選擇日期",
      rangeSeparator: "至",
      startPlaceholder: "開始日期",
      endPlaceholder: "結束日期",
      clearable: !node.required,
      "onUpdate:modelValue": (value) => {
        if (range) {
          node.dataset.dateRange = JSON.stringify(value);
          setValue(node, value?.join(" 至 ") || "");
        } else setValue(node, value);
      },
    });
  }
  if (node.type === "time")
    return h(ElTimePicker, {
      ...props,
      modelValue: node.value || null,
      valueFormat: "HH:mm:ss",
      "onUpdate:modelValue": (value) => setValue(node, value),
    });
  if (node.type === "number")
    return h(ElInputNumber, {
      ...props,
      key: `${keyFor(node)}-${node.disabled}`,
      modelValue: node.value === "" ? undefined : Number(node.value),
      ...(node.closest(".store-fee-modal-table") ? { size: "default" } : {}),
      controlsPosition: "right",
      min: node.min ? Number(node.min) : undefined,
      max: node.max ? Number(node.max) : undefined,
      step: Number(node.step) || 1,
      "onUpdate:modelValue": (value) => setValue(node, value),
    });
  return h(ElInput, {
    ...props,
    modelValue: node.value,
    type: node.tagName === "TEXTAREA" ? "textarea" : node.type || "text",
    readonly: node.readOnly,
    maxlength: node.maxLength > 0 ? node.maxLength : undefined,
    rows: node.rows || undefined,
    placeholder: node.placeholder,
    "onUpdate:modelValue": (value) => setValue(node, value, false),
    onChange: () => emit(node, "change"),
    onKeydown: (event) => {
      const forwarded = new KeyboardEvent("keydown", {
        key: event.key,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(forwarded);
      if (
        event.key === "Enter" &&
        node.tagName !== "TEXTAREA" &&
        !forwarded.defaultPrevented &&
        node.form
      ) {
        node.form.requestSubmit();
        refresh();
      }
      if (forwarded.defaultPrevented) event.preventDefault();
      refresh();
    },
  });
}
function renderButton(node) {
  if (!controlPermitted(node)) return null;
  if (node.getAttribute("role") === "switch")
    return h(ElSwitch, {
      ...propsFor(node),
      modelValue: node.getAttribute("aria-checked") === "true",
      disabled: node.disabled,
      "aria-label": controlLabel(node),
      onChange: (event) => activate(node, event),
    });
  const text = node.textContent.trim();
  const type = node.classList.contains("danger")
    ? "danger"
    : node.classList.contains("success")
      ? "success"
      : node.classList.contains("primary") ||
          (node.classList.contains("btn") && !node.matches(".plain,.gray"))
        ? "primary"
        : "default";
  const grantAction = node.matches(".user-grant-add,.user-grant-remove");
  const hasText = !grantAction && text.length > 0 && text !== "+";
  const isPurePlusIcon = text === "+";
  const buttonIcon = node.matches(".user-grant-remove") ? Delete : grantAction || isPurePlusIcon ? Plus : undefined;
  const button = h(
    ElButton,
    {
      ...propsFor(node),
      type,
      circle: grantAction,
      disabled: node.disabled,
      size: node.closest("td") ? "default" : "large",
      icon: buttonIcon,
      "aria-label": node.getAttribute("aria-label") || undefined,
      "aria-pressed": node.getAttribute("aria-pressed") || undefined,
      onClick: (event) => activate(node, event),
    },
    () => {
      if (hasText) return text;
      if (isPurePlusIcon || grantAction) return null;
      return children(node);
    },
  );
  return node.title
    ? h(ElTooltip, { content: node.title }, () => button)
    : button;
}
function renderCell(row, index) {
  const cell = cellPositions.get(row)?.[index]?.cell;
  if (!cell) return [];
  const text = cell.textContent.trim();
  if (cell.closest(".order-history")) return children(cell);
  if (cell.closest(".store-fee-versions-table") && ["生效中","待生效","已結束","未套用"].includes(text)) {
    const reason = cell.querySelector("[title]")?.title;
    const badge = h(ElTag, {type:{生效中:"success",待生效:"warning",已結束:"info",未套用:"info"}[text],effect:"light"},()=>text);
    return reason ? h(ElTooltip,{content:reason,placement:"top"},{default:()=>badge}) : badge;
  }
  if (cell.closest(".product-table")) {
    if (index === 6 || index === 7) {
      const parts = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
      if (parts) return h("div", {class:"product-list-datetime"}, [h("div",parts[1]),h("div",parts[2])]);
    }
    if (index === 8) return h("div", {class:"product-list-actions"}, children(cell, child => child.nodeName === "BR"));
  }
  if (
    (cell.closest(".payment-table") || cell.closest(".store-fee-versions-table")) &&
    ["啟用", "未啟用", "已停用", "停用"].includes(text)
  ) {
    return h(
      ElTag,
      {
        type: { 啟用: "success", 未啟用: "warning", 已停用: "info", 停用: "info" }[text],
        effect: "light",
      },
      () => text,
    );
  }
  if (
    cell.childElementCount === 0 &&
    /^(啟用|不啟用|上架中|已下架|交易成功|取消交易|部份退款|開發票成功)$/.test(
      text,
    )
  ) {
    return h(
      ElTag,
      {
        type:
          /成功|啟用|上架中/.test(text) && text !== "不啟用"
            ? "success"
            : /退款|取消/.test(text)
              ? "warning"
              : "info",
        effect: "light",
      },
      () => text,
    );
  }
  return children(cell);
}
function renderColumns(table) {
  const rows = [...(table.tHead?.rows || [])];
  if (!rows.length) return null;
  function build(rowIndex, offset, limit) {
    let cursor = offset;
    return [...rows[rowIndex].cells]
      .map((cell) => {
        const index = cursor;
        cursor += cell.colSpan;
        if (index >= limit) return null;
        const title = cell.textContent.trim();
        const grouped = cell.colSpan > 1 && rowIndex + 1 < rows.length;
        return h(
          ElTableColumn,
          {
            key: keyFor(cell),
            label: title,
            ...columnSizing(title, table),
            align: "left",
            fixed:
              /^(功能|操作)$/.test(title) &&
              index === rows[0].cells.length - 1 &&
              !grouped &&
              innerWidth >= 1024
                ? "right"
                : undefined,
            ...(grouped ? {} : { columnKey: String(index) }),
          },
          grouped
            ? {
                default: () => build(rowIndex + 1, index, index + cell.colSpan),
              }
            : {
                default: ({ row }) => renderCell(row, index),
              },
        );
      })
      .filter(Boolean);
  }
  // Store settings has a two-row header: assign child offsets independently of
  // the sibling rowspans so every payment method retains the correct value.
  if (rows.length > 1) {
    let offset = 0,
      childOffset = 0;
    return [...rows[0].cells].map((cell) => {
      const start = offset;
      offset += cell.colSpan;
      if (cell.colSpan > 1) {
        const cells = [...rows[1].cells].slice(
          childOffset,
          childOffset + cell.colSpan,
        );
        childOffset += cell.colSpan;
        return h(
          ElTableColumn,
          { key: keyFor(cell), label: cell.textContent.trim(), align: "left" },
          () =>
            cells.map((child, i) =>
              h(
                ElTableColumn,
                {
                  key: keyFor(child),
                  label: child.textContent.trim(),
                  minWidth: 170,
                  align: "left",
                },
                { default: ({ row }) => renderCell(row, start + i) },
              ),
            ),
        );
      }
      return h(
        ElTableColumn,
        {
          key: keyFor(cell),
          label: cell.textContent.trim(),
          ...columnSizing(cell.textContent.trim()),
          align: "left",
        },
        { default: ({ row }) => renderCell(row, start) },
      );
    });
  }
  return build(0, 0, Infinity);
}
function renderTable(node) {
  const rows = [...(node.tBodies[0]?.rows || node.rows)].filter(
    (row) => !row.querySelector(".empty"),
  );
  const grid = [];
  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ||= [];
    let column = 0;
    for (const cell of row.cells) {
      while (grid[rowIndex][column]) column++;
      for (let y = 0; y < cell.rowSpan; y++) {
        grid[rowIndex + y] ||= [];
        for (let x = 0; x < cell.colSpan; x++)
          grid[rowIndex + y][column + x] = {
            cell,
            rowspan: y || x ? 0 : cell.rowSpan,
            colspan: y || x ? 0 : cell.colSpan,
          };
      }
      column += cell.colSpan;
    }
    cellPositions.set(row, grid[rowIndex]);
  });
  const pageState = tablePages.get(node);
  const data = pageState
    ? rows.slice(
        (pageState.page - 1) * pageState.size,
        pageState.page * pageState.size,
      )
    : rows;
  // Keyed DOM rows remain raw so Vue never proxies native HTMLTableRowElement.
  return h(
    ElTable,
    {
      ...propsFor(node),
      ...(node.closest(".store-fee-modal-table") ? { size: "default" } : {}),
      data,
      border: !node.closest(".order-history"),
      stripe: false,
      rowKey: (row) => keyFor(row),
      style: { width: "100%" },
      tableLayout: "fixed",
      spanMethod: ({ row, columnIndex }) => {
        const cell = cellPositions.get(row)?.[columnIndex];
        return cell ? [cell.rowspan, cell.colspan] : [1, 1];
      },
      showHeader: !!node.tHead?.rows.length,
      showSummary: !!node.tFoot?.rows.length,
      summaryMethod: () =>
        [...(node.tFoot?.rows[0]?.cells || [])].map((cell) => cell.textContent),
    },
    {
      default: () =>
        renderColumns(node) ||
        Array.from(
          { length: Math.max(0, ...grid.map((row) => row.length)) },
          (_, index) =>
            h(
              ElTableColumn,
              { key: index, minWidth: 160 },
              { default: ({ row }) => renderCell(row, index) },
            ),
        ),
      empty: () =>
        h(ElEmpty, {
          description: node.querySelector(".empty")?.textContent || "暫無資料",
          imageSize: 64,
        }),
    },
  );
}
function renderPager(node) {
  const count = Number(node.textContent.match(/共\s*(\d+)/)?.[1] || 0);
  const sizeControl = node.querySelector("select");
  const state = localPage.get(node) || {
    page: 1,
    size: Number(sizeControl?.value.match(/\d+/)?.[0]) || 50,
  };
  localPage.set(node, state);
  const current = node.textContent.match(/第\s*(\d+)\s*\//);
  if (current) state.page = Number(current[1]);
  const prev = node.querySelector("[data-action=prev]");
  const next = node.querySelector("[data-action=next]");
  const changePage = (value) => {
    if (prev && next) {
      const action = value > state.page ? "next" : "prev";
      for (let step = 0; step < Math.abs(value - state.page); step++)
        source.querySelector(`.sys-pager [data-action="${action}"]`)?.click();
    } else {
      state.page = value;
      const table = node.closest("main")?.querySelector("table");
      if (table) tablePages.set(table, state);
    }
    refresh();
  };
  const pageSizes = sizeControl
    ? [
        ...new Set(
          [...sizeControl.options]
            .map((option) => Number(option.value.match(/\d+/)?.[0]))
            .filter(Number.isFinite)
            .filter((size) => size > 0),
        ),
      ]
    : [10, 20, 50, 100];
  return h(
    "div",
    { ...propsFor(node), class: ["ep-pagination", ...classNames(node)] },
    [
      h(ElPagination, {
        total: count,
        currentPage: state.page,
        pageSize: state.size,
        pageSizes,
        layout:
          innerWidth < 600
            ? "total, prev, pager, next"
            : "total, sizes, prev, pager, next, jumper",
        background: false,
        small: true,
        "onUpdate:currentPage": changePage,
        "onUpdate:pageSize": (value) => {
          state.size = value;
          state.page = 1;
          if (sizeControl)
            setValue(
              sizeControl,
              [...sizeControl.options].find(
                (option) => Number(option.value.match(/\d+/)?.[0]) === value,
              )?.value || String(value),
            );
          else refresh();
        },
      }),
    ],
  );
}
function renderMulti(node) {
  const summary = node.querySelector("summary");
  const inputs = [...node.querySelectorAll("input[type=checkbox]")];
  return h(
    ElSelect,
    {
      ...propsFor(node),
      multiple: true,
      collapseTags: true,
      collapseTagsTooltip: true,
      modelValue: inputs
        .filter((input) => input.checked)
        .map((input) => input.parentElement.textContent.trim()),
      "aria-label": summary.getAttribute("aria-label"),
      placeholder: "請選擇",
      "onUpdate:modelValue": (values) => {
        const changes = inputs.filter(
          (input) =>
            values.includes(input.parentElement.textContent.trim()) !==
            input.checked,
        );
        for (const input of changes) {
          input.checked = values.includes(
            input.parentElement.textContent.trim(),
          );
          emit(input, "change");
        }
      },
    },
    () =>
      inputs.map((input) =>
        h(ElOption, {
          key: input.parentElement.textContent.trim(),
          label: input.parentElement.textContent.trim(),
          value: input.parentElement.textContent.trim(),
        }),
      ),
  );
}
function renderDialog(node) {
  const heading = node.querySelector("h2,h3");
  const labelled = node.getAttribute("aria-labelledby");
  const title =
    heading?.textContent ||
    (labelled && node.querySelector("#" + CSS.escape(labelled))?.textContent) ||
    node.getAttribute("aria-label") ||
    "詳細資料";
  const dialogLabel = node.getAttribute("aria-label");
  const width = node.classList.contains("product-modal") ? 760 : node.classList.contains("refund-modal") ? "80vw" : node.querySelector("#store-fee-modal-form") ? 1040 : /report|payment-links|fee-schedule/.test(node.className)
    ? 1320
    : /user-create|role-modal|product-modal|sys-payment/.test(node.className)
      ? 960
      : 800;
  return h(
    ElDialog,
    {
      ...propsFor(node),
      modelValue: node.open,
      title:
        dialogLabel && !title.includes(dialogLabel)
          ? `${dialogLabel}：${title}`
          : title,
      width,
      appendToBody: true,
      closeOnClickModal: false,
      destroyOnClose: false,
      alignCenter: !node.classList.contains("refund-modal"),
      ...(node.classList.contains("refund-modal") ? {top:"20vh"} : {}),
      "onUpdate:modelValue": (value) => {
        if (!value) cancelDialog(node);
      },
      onClosed: () => returnFocus.get(node)?.focus?.(),
    },
    () =>
      children(
        node,
        (child) =>
          child.nodeType === 1 &&
          (child.contains(heading) ||
            child === heading ||
            child.classList.contains("product-date-picker") ||
            (child.tagName === "BUTTON" &&
              child.getAttribute("aria-label")?.startsWith("關閉"))),
      ),
  );
}
const alertSelector = '[role="alert"],#sys-feedback,.refund-notice';
function isAlertNode(node) { return node.matches(alertSelector); }
function renderGlobalAlerts() {
  const nodes = [...source.querySelectorAll(alertSelector)].filter(node => {
    if (!node.textContent.trim() || validationTarget(node)) return false;
    for (let parent = node; parent && parent !== source; parent = parent.parentElement) {
      if (parent.hidden || (parent.tagName === "DIALOG" && !parent.open)) return false;
    }
    return true;
  });
  return h(Teleport, {to:"body"}, h("div", {class:"platform-alert-stack", "aria-live":"polite"}, nodes.map(node => h(ElAlert, {
    key:keyFor(node), title:node.textContent.trim(), showIcon:true, closable:true,
    type:node.dataset.type || (node.id === "sys-feedback" || node.classList.contains("refund-notice") ? "success" : "error"),
    onClose:() => {node.textContent = ""; refresh();},
  }))));
}
function renderNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (
    node.nodeType !== Node.ELEMENT_NODE ||
    node.hidden ||
    ["SCRIPT", "STYLE", "OPTION"].includes(node.tagName)
  )
    return null;
  if (node.style.display === "none") return null;
  const tag = node.tagName;
  const fieldLabel = modalFieldLabel(node);
  if (fieldLabel) return h("span", {
    ...propsFor(node),
    class: [...classNames(node), "modal-field-label", {"ep-required":fieldLabel.required}],
    onClick: node.htmlFor ? () => source.querySelector(`#${CSS.escape(node.htmlFor)}`)?.focus() : undefined,
  }, fieldLabel.text);
  if (tag === "A" && node.getAttribute("href") === "#statement-edit" && !permitted("statements", "edit")) return node.textContent;
  if (isListActions(node) && node.querySelector(":scope>.pager")) {
    const pager = node.querySelector(":scope>.pager");
    return h("div", { class: "ep-list-toolbar", key: keyFor(node) }, [
      renderPager(pager),
      h(
        "div",
        { class: "ep-list-actions" },
        children(node, (child) => child === pager),
      ),
    ]);
  }
  if (
    isListActions(node) &&
    node.nextElementSibling?.classList.contains("pager")
  ) {
    return h("div", { class: "ep-list-toolbar", key: keyFor(node) }, [
      renderPager(node.nextElementSibling),
      h(
        "div",
        { class: "ep-list-actions" },
        tag === "BUTTON" ? [renderButton(node)] : children(node),
      ),
    ]);
  }
  if (
    node.classList.contains("pager") &&
    isListActions(node.previousElementSibling)
  )
    return null;
  if (node.classList.contains("product-date-picker") || node.id === "collapse")
    return null;
  if (tag === "DIALOG") return renderDialog(node);
  if (tag === "SELECT") return renderSelect(node);
  if (tag === "INPUT" || tag === "TEXTAREA") return renderInput(node);
  if (tag === "BUTTON") return renderButton(node);
  if (tag === "TABLE") return renderTable(node);
  if (node.classList.contains("order-info")) {
    const trigger = node.querySelector("button");
    const content = node.querySelector(".order-info-tooltip");
    return h("span", propsFor(node), [
      h(
        ElTooltip,
        {
          effect: "dark",
          placement: "bottom",
          trigger: ["hover", "focus"],
          popperClass: "ep-order-info-popper",
        },
        {
          default: () => renderButton(trigger),
          content: () => children(content),
        },
      ),
    ]);
  }
  if (node.classList.contains("product-price-info-wrapper")) {
    const trigger = node.querySelector("button");
    const content = node.querySelector(".product-price-tooltip");
    return h(
      ElTooltip,
      {
        content: content.innerHTML,
        rawContent: true,
        effect: "dark",
        placement: "top",
        trigger: "click",
      },
      () => renderButton(trigger),
    );
  }
  if (node.classList.contains("pager")) return renderPager(node);
  if (
    node.classList.contains("chip") ||
    node.classList.contains("statement-selected") ||
    node.classList.contains("payment-method-chip")
  )
    return h(ElTag, propsFor(node), () => node.textContent);
  if (tag === "IMG" && node.classList.contains("icon")) {
    const name = node.getAttribute("src").split("/").pop().replace(".svg", "");
    return icons[name]
      ? icon(icons[name])
      : h("img", { src: node.src, alt: node.alt, width: 16 });
  }
  if (tag.toLowerCase() === "svg")
    return h(ElIcon, null, () =>
      h("svg", {
        viewBox: node.getAttribute("viewBox"),
        innerHTML: node.innerHTML,
        fill: node.getAttribute("fill") || "none",
        stroke: node.getAttribute("stroke") || "currentColor",
      }),
    );
  if (tag === "A")
    return h(
      ElButton,
      {
        ...propsFor(node),
        size: node.closest("td") ? "default" : "large",
        tag: "a",
        href: node.getAttribute("href"),
        link: !node.classList.contains("detail-back"),
        type: node.classList.contains("detail-back") ? "default" : "primary",
        onClick: (event) => activate(node, event),
      },
      () => children(node),
    );
  if (tag === "FORM")
    return h(
      ElForm,
      {
        ...propsFor(node),
        labelPosition: "top",
        onSubmit: (event) => {
          event.preventDefault();
          node.requestSubmit();
          refresh();
        },
      },
      () => children(node),
    );
  if (tag === "DETAILS") {
    if (node.classList.contains("statement-multi")) return renderMulti(node);
    const summary = node.querySelector(":scope>summary");
    return h(
      ElCollapse,
      {
        ...propsFor(node),
        modelValue: node.open ? ["open"] : [],
        "onUpdate:modelValue": (value) => {
          node.open = value.includes("open");
          refresh();
        },
      },
      () =>
        h(ElCollapseItem, { title: summary?.textContent, name: "open" }, () =>
          children(node, (child) => child === summary),
        ),
    );
  }
  if (tag === "DL") {
    const terms = [...node.querySelectorAll(":scope>dt")];
    return h(
      ElDescriptions,
      { ...propsFor(node), column: node.closest(".order-detail") ? 1 : innerWidth < 768 ? 1 : 2, border: !node.closest(".order-detail") },
      () =>
        terms.map((term) =>
          h(
            ElDescriptionsItem,
            { key: keyFor(term), label: term.textContent },
            () =>
              term.nextElementSibling ? children(term.nextElementSibling) : "—",
          ),
        ),
    );
  }
  if (isAlertNode(node)) return null;
  if (tag === "BR") return h("br");
  if (tag === "LABEL") {
    const toggle = node.querySelector(
      ":scope>input[type=checkbox],:scope>input[type=radio]",
    );
    if (toggle)
      return h("div", propsFor(node), [
        renderInput(toggle, node.textContent.trim()),
      ]);
    const labelFor = node.getAttribute("for");
    return h(
      "div",
      {
        ...propsFor(node),
        onClick: labelFor
          ? () => source.querySelector("#" + CSS.escape(labelFor))?.focus()
          : undefined,
      },
      children(node),
    );
  }
  if (node.classList.contains("report-tabs")) {
    const buttons = [...node.querySelectorAll("button")];
    return h(
      ElTabs,
      {
        modelValue: String(
          buttons.findIndex(
            (button) => button.getAttribute("aria-selected") === "true",
          ),
        ),
        onTabChange: (value) => activate(buttons[Number(value)]),
      },
      () =>
        buttons.map((button, index) =>
          h(ElTabPane, { name: String(index), label: button.textContent }),
        ),
    );
  }
  const safeTag = [
    "P",
    "SPAN",
    "STRONG",
    "EM",
    "SMALL",
    "H1",
    "H2",
    "H3",
    "UL",
    "OL",
    "LI",
    "HR",
  ].includes(tag)
    ? tag.toLowerCase()
    : "div";
  return h(
    safeTag,
    {
      ...propsFor(node),
      role: node.getAttribute("role") || undefined,
      "aria-label": node.getAttribute("aria-label") || undefined,
      onClick: node.hasAttribute("tabindex")
        ? (event) => activate(node, event)
        : undefined,
    },
    children(node),
  );
}
function menuItems(aside) {
  const menuIcon = (node) => {
    const image = node.querySelector("img");
    return (
      icons[image?.getAttribute("src").split("/").pop().replace(".svg", "")] ||
      Document
    );
  };
  return [...aside.children].map((node) => {
    if (node.tagName === "A" && !permitted(pageFeature(node.getAttribute("href")))) return null;
    if (node.tagName === "DETAILS" && ![...node.querySelectorAll("a")].some(link => !link.hidden && permitted(pageFeature(link.getAttribute("href"))))) return null;
    if (node.tagName === "A")
      return h(
        ElMenuItem,
        { index: node.getAttribute("href"), onClick: () => node.click() },
        () => [icon(menuIcon(node)), h("span", node.textContent.trim())],
      );
    if (node.tagName !== "DETAILS") return null;
    const summary = node.querySelector("summary");
    return h(
      ElSubMenu,
      { index: summary.textContent.trim() },
      {
        title: () => [
          icon(menuIcon(node)),
          h("span", summary.textContent.trim()),
        ],
        default: () =>
          [...node.querySelectorAll("a")]
            .filter((link) => !link.hidden && permitted(pageFeature(link.getAttribute("href"))))
            .map((link) =>
              h(
                ElMenuItem,
                {
                  index: link.getAttribute("href"),
                  onClick: () => link.click(),
                },
                () => link.textContent.trim(),
              ),
            ),
      },
    );
  });
}
const isHome = !!source.querySelector("main .welcome");
const App = {
  setup() {
    return () => {
      version.value;
      viewportWidth.value;
      const aside = source.querySelector("aside");
      const main = source.querySelector("main");
      const header = source.querySelector(".shell>header");
      const breadcrumb = header?.querySelector(".breadcrumb");
      const crumbs = breadcrumb
        ? breadcrumb.textContent
            .split("/")
            .map((text) => text.trim())
            .filter(Boolean)
        : [];
      const storeCrumb = breadcrumb?.dataset.storeName;
      if (storeCrumb) crumbs.push(storeCrumb);
      const active =
        aside?.querySelector("a.active")?.getAttribute("href") || "index.html";
      return h(ElConfigProvider, { locale: zhTw, size: "large" }, () => [
        h(ElContainer, { class: ["platform-layout", { "platform-home": isHome }] }, () => [
          h(
            ElAside,
            {
              width: collapsed.value ? "64px" : (isHome || main.matches(".order-detail")) ? "210px" : "224px",
              class: "platform-sidebar",
            },
            () => [
              !isHome && !main.matches(".order-detail") && h(
                "a",
                {
                  href: "index.html",
                  class: "platform-brand",
                  "aria-label": "行動支付支援平台首頁",
                },
                [
                  icon(Goods),
                  !collapsed.value && h("span", "行動支付支援平台"),
                ],
              ),
              h(
                ElMenu,
                {
                  defaultActive: active,
                  defaultOpeneds: collapsed.value || isHome
                    ? []
                    : [...aside.querySelectorAll(main.matches(".order-detail") ? "details[open] > summary" : "summary")].map((node) =>
                        node.textContent.trim(),
                      ),
                  collapse: collapsed.value,
                  backgroundColor: isHome ? "#304156" : "#263445",
                  textColor: isHome ? "#bfcbd9" : "#d3dce6",
                  activeTextColor: isHome ? "#409eff" : "#79bbff",
                  class: "platform-menu",
                },
                () => menuItems(aside),
              ),
            ],
          ),
          h(ElContainer, { class: "platform-content" }, () => [
            h(ElHeader, { class: "platform-header", height: "50px" }, () => [
              h(ElButton, {
                size: "large",
                text: true,
                class: "platform-menu-toggle",
                icon: collapsed.value ? Expand : Fold,
                "aria-label": collapsed.value ? "展開側邊選單" : "收合側邊選單",
                onClick: () => {
                  collapsed.value = !collapsed.value;
                },
              }),
              h(
                ElBreadcrumb,
                { separator: "/", class: "platform-breadcrumb" },
                () =>
                  crumbs.map((text, index) =>
                    h(ElBreadcrumbItem, { key: index, to: undefined }, () =>
                      index === 0 ? h("a", { href: "index.html" }, text) : storeCrumb && index === 2 ? h("a", {href:"stores.html",class:"platform-store-crumb",onClick:event=>{
                        event.preventDefault();
                        source.querySelector('main [data-action="cancel"]')?.click();
                        refresh();
                      }},text) : h("span", index === crumbs.length-1 ? {"aria-current":"page"} : {}, text),
                    ),
                  ),
              ),
              h("div", { class: "platform-account" }, [
                h(
                  "a",
                  { href: "#", class: "platform-version" },
                  header?.querySelector(".version")?.textContent || "v1.4.2",
                ),
                header?.querySelector(".reset") &&
                  renderNode(header.querySelector(".reset")),
                h(
                  "span",
                  { class: "platform-clock" },
                  header?.querySelector(".clock")?.textContent,
                ),
                h(ElAvatar, { size: isHome ? 40 : 36, class: "platform-avatar" }, () => "S"),
                isHome && h("span", { class: "platform-account-arrow", "aria-hidden": "true" }, [icon(ArrowDown)]),
              ]),
            ]),
            h(ElMain, { class: ["platform-main", ...classNames(main)] }, () => [
              permitted(pageFeature()) ? children(main) : h(ElEmpty, { description: "無存取權限，請聯絡管理員設定此功能權限。" }),
              renderGlobalAlerts(),
              ...[...source.querySelectorAll(":scope>dialog")].map(
                renderDialog,
              ),
              ...[
                ...source.querySelectorAll(
                  ":scope>#sys-feedback,:scope>.refund-notice",
                ),
              ].map(renderNode),
            ]),
          ]),
        ]),
      ]);
    };
  },
};
createApp(App).mount(mount);
window.elementPlatform = { refresh, version: "vue3-element-plus", source };
