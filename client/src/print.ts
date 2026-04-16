import type { OrderDetail, OrderItem, PaymentResult } from './api';

export interface BarChit {
  orderId: string;
  tableId: string;
  items: OrderItem[];
  receivedAt: string;
}

function receiptHtml(order: OrderDetail, payment: PaymentResult): string {
  const date = new Date().toLocaleString();
  const itemRows = order.items.map(item => {
    const mods = item.appliedModifiers.length
      ? item.appliedModifiers.map(m => `<div class="mod">${m.action === 'ADD' ? '+' : '−'} ${m.label}</div>`).join('')
      : '';
    const notes = item.notes ? `<div class="notes">${item.notes}</div>` : '';
    return `
      <tr>
        <td class="qty">${item.quantity}x</td>
        <td class="name">${item.name}${mods}${notes}</td>
        <td class="price">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; padding: 8px; }
  h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
  .date { text-align: center; color: #555; margin-bottom: 8px; }
  .sep { border-top: 1px dashed #aaa; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .qty { width: 24px; vertical-align: top; }
  .name { padding-left: 4px; vertical-align: top; }
  .price { text-align: right; vertical-align: top; white-space: nowrap; }
  .mod { font-size: 10px; color: #555; padding-left: 4px; }
  .notes { font-size: 10px; color: #777; font-style: italic; padding-left: 4px; }
  .totals td { padding: 2px 0; }
  .totals .label { font-weight: bold; }
  .totals .amount { text-align: right; }
  .grand { font-size: 14px; font-weight: bold; }
  .method { text-align: center; margin-top: 6px; color: #333; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #888; }
</style>
</head>
<body>
  <h1>RapidTicket</h1>
  <p class="date">${date}</p>
  <div class="sep"></div>
  <table>${itemRows}</table>
  <div class="sep"></div>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="amount">$${payment.subtotal.toFixed(2)}</td></tr>
    <tr><td class="label">Tax</td><td class="amount">$${payment.taxAmount.toFixed(2)}</td></tr>
    ${payment.tipAmount ? `<tr><td class="label">Tip</td><td class="amount">$${payment.tipAmount.toFixed(2)}</td></tr>` : ''}
    <tr class="grand"><td class="label">Total</td><td class="amount">$${payment.total.toFixed(2)}</td></tr>
  </table>
  <p class="method">${payment.status === 'COMPLETED' ? 'PAID' : payment.status}</p>
  <p class="footer">Thank you!</p>
</body>
</html>`;
}

function barChitHtml(chit: BarChit): string {
  const tableLabel = chit.tableId.slice(0, 8).toUpperCase();
  const time = new Date(chit.receivedAt).toLocaleTimeString();
  const itemRows = chit.items.map(item => {
    const mods = item.appliedModifiers.length
      ? item.appliedModifiers.map(m => `<div class="mod">${m.action === 'ADD' ? '+' : '−'} ${m.label}</div>`).join('')
      : '';
    const notes = item.notes ? `<div class="notes">${item.notes}</div>` : '';
    return `<div class="item"><span class="qty">${item.quantity}x</span> <span class="name">${item.name}</span>${mods}${notes}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 13px; width: 280px; padding: 8px; }
  h2 { font-size: 14px; margin-bottom: 2px; }
  .sub { font-size: 11px; color: #555; margin-bottom: 6px; }
  .sep { border-top: 1px dashed #aaa; margin: 6px 0; }
  .item { margin-bottom: 4px; }
  .qty { font-weight: bold; }
  .mod { font-size: 10px; color: #555; padding-left: 16px; }
  .notes { font-size: 10px; color: #777; font-style: italic; padding-left: 16px; }
</style>
</head>
<body>
  <h2>BAR CHIT — TABLE ${tableLabel}</h2>
  <p class="sub">${time}</p>
  <div class="sep"></div>
  ${itemRows}
</body>
</html>`;
}

async function sendToPrinter(html: string): Promise<void> {
  if (window.electronAPI?.print?.receipt) {
    await window.electronAPI.print.receipt(html);
  } else {
    // Browser fallback: open in new window and print
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }
}

export async function printReceipt({ order, payment }: { order: OrderDetail; payment: PaymentResult }): Promise<void> {
  await sendToPrinter(receiptHtml(order, payment));
}

export async function printBarChit(chit: BarChit): Promise<void> {
  await sendToPrinter(barChitHtml(chit));
}
