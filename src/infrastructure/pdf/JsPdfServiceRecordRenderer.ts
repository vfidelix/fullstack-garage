import { jsPDF } from 'jspdf';

import type {
  ServiceRecordItem,
  ServiceRecordSnapshot,
} from '../../domain/service-records/serviceRecord';
import type { ServiceRecordPdfRenderer } from '../../application/ports/serviceRecordPdfRenderer';
import {
  createServiceRecordError,
  type ServiceRecordResult,
} from '../../application/service-records/serviceRecordResult';
import mainLogo from '../../shared/assets/brand/Fullstack-Garage-Logo-On-Light.png';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
const BOTTOM_MARGIN = 18;
const ROSSO_CORSA: readonly [number, number, number] = [218, 41, 28];
const INK: readonly [number, number, number] = [24, 24, 24];
const BODY: readonly [number, number, number] = [80, 80, 80];

type PdfDocument = InstanceType<typeof jsPDF>;

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year === undefined || month === undefined || day === undefined ? value : `${day}/${month}/${year}`;
}

function formatPurchaseCost(value: number): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}$${String(Math.floor(absolute / 100))}.${String(absolute % 100).padStart(2, '0')}`;
}

function optionalDetail(label: string, value: string | undefined): string | undefined {
  return value === undefined ? undefined : `${label}: ${value}`;
}

function itemDetail(item: ServiceRecordItem): string {
  const details = [
    optionalDetail('Category', item.category),
    optionalDetail('Brand', item.brand),
    optionalDetail('Specification', item.specification),
    optionalDetail('Part number', item.partNumber),
    optionalDetail('Supplier', item.supplier),
    item.quantity === undefined ? undefined : `Quantity: ${String(item.quantity)}${item.unit === undefined ? '' : ` ${item.unit}`}`,
    item.purchaseCostMinor === undefined ? undefined : `Purchase Cost: ${formatPurchaseCost(item.purchaseCostMinor)}`,
    optionalDetail('Notes', item.notes),
  ].filter((detail): detail is string => detail !== undefined);

  return details.join('  •  ');
}

function pdfLines(value: unknown, fallback: string): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    const lines = value.filter((line): line is string => typeof line === 'string');
    if (lines.length > 0) {
      return lines;
    }
  }
  return [fallback];
}

export class JsPdfServiceRecordRenderer implements ServiceRecordPdfRenderer {
  public render(snapshot: ServiceRecordSnapshot): Promise<ServiceRecordResult<Blob>> {
    try {
      const pdf = new jsPDF({ format: 'a4', orientation: 'p', unit: 'mm' });
      let cursor = this.renderHeader(pdf, snapshot);

      cursor = this.writeSection(pdf, 'VEHICLE', [
        `${snapshot.vehicle.make} ${snapshot.vehicle.model}${snapshot.vehicle.year === undefined ? '' : ` (${snapshot.vehicle.year})`}`,
        optionalDetail('Registration', snapshot.vehicle.registration),
        optionalDetail('VIN', snapshot.vehicle.vin),
        optionalDetail('Engine', snapshot.vehicle.engine),
        `Service odometer: ${String(snapshot.odometer)} ${snapshot.vehicle.odometerUnit}`,
      ].filter((line): line is string => line !== undefined), cursor);

      cursor = this.writeSection(pdf, 'SERVICE DETAILS', [
        optionalDetail('Performed by', snapshot.performedBy),
        optionalDetail('Location', snapshot.location),
        optionalDetail('Summary', snapshot.summary),
        optionalDetail('Notes', snapshot.notes),
        optionalDetail('Next service due', snapshot.nextServiceDueDate === undefined ? undefined : formatDate(snapshot.nextServiceDueDate)),
        optionalDetail('Next service odometer', snapshot.nextServiceDueOdometer === undefined
          ? undefined
          : `${String(snapshot.nextServiceDueOdometer)} ${snapshot.vehicle.odometerUnit}`),
      ].filter((line): line is string => line !== undefined), cursor);

      cursor = this.writeItemSection(pdf, snapshot.items, cursor);
      this.writeTotal(pdf, snapshot.totalPurchaseCostMinor, cursor);

      return Promise.resolve({ ok: true, value: pdf.output('blob') });
    } catch {
      return Promise.resolve({ ok: false, error: createServiceRecordError('temporary_failure') });
    }
  }

  private renderHeader(pdf: PdfDocument, snapshot: ServiceRecordSnapshot): number {
    pdf.addImage(mainLogo, 'PNG', 14, 12, 38, 12);
    pdf.setFillColor(...ROSSO_CORSA);
    pdf.rect(0, 0, PAGE_WIDTH, 5, 'F');
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('SERVICE RECORD', PAGE_MARGIN, 35);
    pdf.setFontSize(12);
    pdf.text(snapshot.displayNumber, PAGE_MARGIN, 43);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...BODY);
    pdf.text(`Service date: ${formatDate(snapshot.serviceDate)}`, PAGE_MARGIN, 50);
    pdf.setDrawColor(...ROSSO_CORSA);
    pdf.line(PAGE_MARGIN, 56, PAGE_WIDTH - PAGE_MARGIN, 56);
    return 65;
  }

  private writeSection(pdf: PdfDocument, title: string, lines: readonly string[], cursor: number): number {
    if (lines.length === 0) {
      return cursor;
    }

    let nextCursor = this.ensureRoom(pdf, cursor, 14);
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(title, PAGE_MARGIN, nextCursor);
    nextCursor += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...BODY);

    for (const line of lines) {
      nextCursor = this.writeWrappedLine(pdf, line, nextCursor);
    }
    return nextCursor + 5;
  }

  private writeItemSection(pdf: PdfDocument, items: readonly ServiceRecordItem[], cursor: number): number {
    let nextCursor = this.ensureRoom(pdf, cursor, 14);
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('MAINTENANCE ITEMS', PAGE_MARGIN, nextCursor);
    nextCursor += 6;

    if (items.length === 0) {
      return this.writeWrappedLine(pdf, 'No itemised maintenance details recorded.', nextCursor) + 5;
    }

    for (const item of [...items].sort((left, right) => left.sortOrder - right.sortOrder)) {
      nextCursor = this.ensureRoom(pdf, nextCursor, 12);
      pdf.setTextColor(...INK);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(item.name, PAGE_MARGIN, nextCursor);
      nextCursor += 5;
      const details = itemDetail(item);
      if (details !== '') {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...BODY);
        nextCursor = this.writeWrappedLine(pdf, details, nextCursor);
      }
      nextCursor += 3;
    }
    return nextCursor + 2;
  }

  private writeTotal(pdf: PdfDocument, total: number, cursor: number): void {
    const nextCursor = this.ensureRoom(pdf, cursor, 14);
    pdf.setDrawColor(...ROSSO_CORSA);
    pdf.line(PAGE_MARGIN, nextCursor, PAGE_WIDTH - PAGE_MARGIN, nextCursor);
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`Total Parts & Consumables: ${formatPurchaseCost(total)}`, PAGE_MARGIN, nextCursor + 7);
  }

  private writeWrappedLine(pdf: PdfDocument, line: string, cursor: number): number {
    const wrapped = pdfLines(pdf.splitTextToSize(line, CONTENT_WIDTH) as unknown, line);
    const nextCursor = this.ensureRoom(pdf, cursor, wrapped.length * 4.5);
    pdf.text(wrapped, PAGE_MARGIN, nextCursor);
    return nextCursor + (wrapped.length * 4.5) + 2;
  }

  private ensureRoom(pdf: PdfDocument, cursor: number, requiredHeight: number): number {
    if (cursor + requiredHeight <= PAGE_HEIGHT - BOTTOM_MARGIN) {
      return cursor;
    }

    pdf.addPage();
    return PAGE_MARGIN;
  }
}
