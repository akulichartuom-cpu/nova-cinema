/*
 * NOVA CINEMA — журнал продаж бара.
 *
 * operator.html пишет сюда (nova_sales_log) каждый раз, когда заказ отмечают
 * "оплачен". admin.html собирает отчёт (nova_sales_report) из этого журнала
 * на этом же устройстве + из файлов, выгруженных с других касс выдачи —
 * своей единой базы между устройствами у статического сайта нет.
 */
(function (global) {
  "use strict";

  var LOG_KEY = "nova_sales_log";       // пишет operator.html
  var REPORT_KEY = "nova_sales_report"; // копит admin.html (по номеру заказа, без дублей)

  function readLog() {
    try {
      var arr = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  // Добавляет одну продажу в локальный журнал этой кассы (идемпотентно по orderNo).
  function appendSale(entry) {
    var log = readLog();
    if (log.some(function (e) { return e.orderNo === entry.orderNo; })) return;
    log.push(entry);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch (e) {}
  }

  function readReport() {
    try {
      var obj = JSON.parse(localStorage.getItem(REPORT_KEY) || "{}");
      return (obj && typeof obj === "object") ? obj : {};
    } catch (e) { return {}; }
  }

  function saveReport(map) {
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(map)); } catch (e) {}
  }

  // Сливает массив продаж (из readLog() или из импортированного файла) в общий
  // отчёт, ключуя по orderNo — повторный импорт того же файла ничего не задвоит.
  function mergeIntoReport(entries) {
    var map = readReport();
    (entries || []).forEach(function (e) {
      if (e && e.orderNo) map[e.orderNo] = e;
    });
    saveReport(map);
    return map;
  }

  function reportEntries() {
    var map = readReport();
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function filterByPeriod(entries, fromStr, toStr) {
    var from = fromStr ? new Date(fromStr + "T00:00:00") : null;
    var to = toStr ? new Date(toStr + "T23:59:59") : null;
    return entries.filter(function (e) {
      var t = new Date(e.ts);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }

  // {rows:[{id,name,qty,revenue}], totals:{orders,qty,revenue}}
  function aggregateByItem(entries) {
    var byItem = {};
    var totalRevenue = 0;
    entries.forEach(function (e) {
      totalRevenue += Number(e.total) || 0;
      (e.items || []).forEach(function (it) {
        var row = byItem[it.id] || (byItem[it.id] = { id: it.id, name: it.name, qty: 0, revenue: 0 });
        row.qty += it.qty;
        row.revenue += (Number(it.price) || 0) * it.qty;
        row.name = it.name || row.name; // самое свежее известное название
      });
    });
    var rows = Object.keys(byItem).map(function (k) { return byItem[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });
    return { rows: rows, totals: { orders: entries.length, revenue: totalRevenue } };
  }

  function exportLogFile() {
    var log = readLog();
    var blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = "nova-sales-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  global.NovaSales = {
    LOG_KEY: LOG_KEY,
    REPORT_KEY: REPORT_KEY,
    readLog: readLog,
    appendSale: appendSale,
    readReport: readReport,
    mergeIntoReport: mergeIntoReport,
    reportEntries: reportEntries,
    filterByPeriod: filterByPeriod,
    aggregateByItem: aggregateByItem,
    exportLogFile: exportLogFile
  };
})(window);
