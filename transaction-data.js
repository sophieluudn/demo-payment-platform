(() => {
  // ───────────────────────── 共用常數 ─────────────────────────
  const STATUS = {
    INVOICED: "開發票成功",
    PARTIAL_REFUND: "部份退款",
    CANCELED: "取消交易",
  };

  const PAYMENT = {
    CREDIT_CARD: "信用卡一次付清",
    LINE_PAY: "Line Pay",
    GOOGLE_PAY: "Google Pay",
  };

  const CARD = {
    DOMESTIC: "國內卡",
    NONE: "", // 非刷卡的付款方式沒有卡別
  };

  const UNIT = "行動發展部";
  const TAXABLE = "應稅";

  // ───────────────────────── 訂單列表 ─────────────────────────
  // window.transactionOrders 的每一筆是「依欄位順序排列的陣列」，
  // 其他程式是用索引（0~13）讀取，所以輸出格式不能改。
  // 這裡用具名欄位來寫資料，再由 order() 依 ORDER_COLUMNS 的順序轉回陣列。
  // ※ 欄位名稱是依資料內容推測的，若與實際表頭不同，請修改這裡與下方資料。
  const ORDER_COLUMNS = [
    "orderNo", //        0  訂單編號
    "tradeNo", //        1  交易編號
    "itemName", //       2  商品名稱
    "store", //          3  單位（？）
    "department", //     4  部門（？）
    "cardType", //       5  卡別
    "paymentMethod", //  6  付款方式
    "amount", //         7  金額（字串）
    "createdAt", //      8  建立時間
    "paidAt", //         9  付款時間（？）
    "status", //        10  交易狀態
    "taxType", //       11  稅別
    "invoiceNo", //     12  發票號碼
    "invoiceStatus", // 13  發票狀態
  ];

  const order = (fields) => ORDER_COLUMNS.map((column) => fields[column]);

  window.transactionOrders = [
    order({
      orderNo: "202609080050001",
      tradeNo: "26090810132813893",
      itemName: "【塩田千春…",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2026-09-08 …",
      paidAt: "2026-09-08 …",
      status: STATUS.INVOICED,
      taxType: TAXABLE,
      invoiceNo: "IJ00000002",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202610080050006",
      tradeNo: "2026100802386970310",
      itemName: "9 元",
      store: UNIT,
      department: UNIT,
      cardType: CARD.NONE,
      paymentMethod: PAYMENT.LINE_PAY,
      amount: "9",
      createdAt: "2026-10-08 15:54:58",
      paidAt: "2026-10-08 15:55:23",
      status: STATUS.INVOICED,
      taxType: TAXABLE,
      invoiceNo: "IJ00000008",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508080050001",
      tradeNo: "25080815181575191",
      itemName: "Lady M",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "1050",
      createdAt: "2025-08-08 12:30:00",
      paidAt: "2025-08-08 12:30:25",
      status: STATUS.PARTIAL_REFUND,
      taxType: TAXABLE,
      invoiceNo: "GH00000132",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050008",
      tradeNo: "25080412320764603",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.GOOGLE_PAY,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.CANCELED,
      taxType: TAXABLE,
      invoiceNo: "GH00000084",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050007",
      tradeNo: "2025080402297268810",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.NONE,
      paymentMethod: PAYMENT.LINE_PAY,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.PARTIAL_REFUND,
      taxType: TAXABLE,
      invoiceNo: "GH00000083",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050006",
      tradeNo: "25080412300264600",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.PARTIAL_REFUND,
      taxType: TAXABLE,
      invoiceNo: "GH00000082",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050005",
      tradeNo: "25080412280664599",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.INVOICED,
      taxType: TAXABLE,
      invoiceNo: "GH00000081",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050004",
      tradeNo: "25080412243664594",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.PARTIAL_REFUND,
      taxType: TAXABLE,
      invoiceNo: "GH00000080",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050002",
      tradeNo: "25080412235064593",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.PARTIAL_REFUND,
      taxType: TAXABLE,
      invoiceNo: "GH00000079",
      invoiceStatus: STATUS.INVOICED,
    }),
    order({
      orderNo: "202508040050003",
      tradeNo: "25080412234264592",
      itemName: "陽光場",
      store: UNIT,
      department: UNIT,
      cardType: CARD.DOMESTIC,
      paymentMethod: PAYMENT.CREDIT_CARD,
      amount: "250",
      createdAt: "2025-08-04 12:30:00",
      paidAt: "2025-08-04 12:30:25",
      status: STATUS.CANCELED,
      taxType: TAXABLE,
      invoiceNo: "GH00000078",
      invoiceStatus: STATUS.INVOICED,
    }),
  ];

  // Reference order supplied for the order-detail demo.
  window.transactionOrders.push(order({
    orderNo:"202610080050001", tradeNo:"26100815345560689", itemName:"(應稅) 不定額商品",
    store:UNIT, department:UNIT, cardType:CARD.DOMESTIC, paymentMethod:PAYMENT.CREDIT_CARD,
    amount:"1008", createdAt:"2026-10-08 15:34:55", paidAt:"2026-10-08 15:34:55",
    status:STATUS.INVOICED, taxType:TAXABLE, invoiceNo:"IJ00000004", invoiceStatus:STATUS.INVOICED,
  }));
  window.transactionDetails = {
    "202610080050001": {
      email:"sophieluudn@gmail.com", ip:"60.248.31.111", estimatedFee:20.16,
      history:[
        ["2026-10-08 15:34:44","交易開始","訂單建立"],
        ["2026-10-08 15:34:44","處理中","開始信用卡交易"],
        ["2026-10-08 15:34:56","處理中","藍新回傳NotifyURL"],
        ["2026-10-08 15:34:56","交易成功","信用卡成功"],
        ["2026-10-08 15:35:00","開發票成功","發票IJ00000004開立成功"],
      ],
    },
  };

  // ───────────────────────── 交易 Demo 狀態 ─────────────────────────
  // 以「訂單編號」為 key。
  //   completed / processed：是否已完成 / 已處理
  //   value：從資料看應為「已退款金額」（部份退款 > 0、取消交易 = 全額、未退款 = 0）
  //   invoices：該訂單開立的發票；部份退款後會多一張重開的發票

  /** 建立一張發票（狀態固定為「開發票成功」） */
  const invoice = (number, amount, date) => ({
    number,
    amount,
    status: STATUS.INVOICED,
    date,
  });

  window.transactionDemoStates = {
    "202508080050001": {
      completed: true,
      processed: true,
      value: 300,
      invoices: [
        invoice("GH00000132", 1050, "2025-08-08 12:30:25"),
        invoice("GH00000214", 750, "2025-08-08 12:30:25"),
      ],
    },
    "202508040050008": {
      completed: true,
      processed: true,
      value: 250,
      invoices: [invoice("GH00000084", 250, "2025-08-04 12:30:25")],
    },
    "202508040050007": {
      completed: true,
      processed: true,
      value: 100,
      invoices: [invoice("GH00000083", 250, "2025-08-04 12:30:25")],
    },
    "202508040050006": {
      completed: true,
      processed: true,
      value: 100,
      invoices: [
        invoice("GH00000082", 250, "2025-08-04 12:30:25"),
        invoice("GH00000096", 150, "2025-08-04 12:30:25"),
      ],
    },
    "202508040050005": {
      completed: false,
      processed: false,
      value: 0,
      invoices: [invoice("GH00000081", 250, "2025-08-04 12:30:25")],
    },
    "202508040050004": {
      completed: true,
      processed: true,
      value: 100,
      invoices: [
        invoice("GH00000080", 250, "2025-08-04 12:30:25"),
        invoice("GH00000095", 150, "2025-08-04 12:30:25"),
      ],
    },
    "202508040050002": {
      completed: true,
      processed: true,
      value: 100,
      invoices: [
        invoice("GH00000079", 250, "2025-08-04 12:30:25"),
        invoice("GH00000094", 150, "2025-08-04 12:30:25"),
      ],
    },
    "202508040050003": {
      completed: true,
      processed: true,
      value: 250,
      invoices: [invoice("GH00000078", 250, "2025-08-04 12:30:25")],
    },
  };
})();