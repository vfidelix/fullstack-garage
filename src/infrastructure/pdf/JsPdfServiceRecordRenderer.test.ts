import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServiceRecordSnapshot } from '../../domain/service-records/serviceRecord';
import { JsPdfServiceRecordRenderer } from './JsPdfServiceRecordRenderer';

const { constructor, pdf } = vi.hoisted(() => {
  const document = {
    addImage: vi.fn(),
    addPage: vi.fn(),
    line: vi.fn(),
    output: vi.fn(() => new Blob(['service-record-pdf'], { type: 'application/pdf' })),
    rect: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
  };

  function MockJsPdf() {
    return document;
  }

  return { constructor: vi.fn(MockJsPdf), pdf: document };
});

vi.mock('jspdf', () => ({ jsPDF: constructor }));

const snapshot: ServiceRecordSnapshot = {
  id: '50000000-0000-4000-8000-000000000001',
  schemaVersion: 1,
  templateVersion: 1,
  brandingVersion: 1,
  serviceRecordId: '40000000-0000-4000-8000-000000000001',
  displayNumber: 'SR-000001',
  status: 'completed',
  serviceRecordVersion: 2,
  serviceDate: '2026-07-22',
  generatedAt: '2026-07-22T12:00:00.000Z',
  createdById: '30000000-0000-4000-8000-000000000001',
  vehicle: {
    make: 'Ferrari',
    model: 'Roma',
    registration: 'GARAGE',
    odometerUnit: 'km',
  },
  odometer: 12_500,
  summary: 'Annual service',
  notes: 'Road test completed.',
  currencyCode: 'AUD',
  items: [
    { id: 'item-2', kind: 'part', name: 'Oil filter', purchaseCostMinor: 4_500, sortOrder: 1 },
    { id: 'item-1', kind: 'work', name: 'Inspection', sortOrder: 0 },
  ],
  totalPurchaseCostMinor: 4_500,
};

describe('JsPdfServiceRecordRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdf.output.mockReturnValue(new Blob(['service-record-pdf'], { type: 'application/pdf' }));
    pdf.splitTextToSize.mockImplementation((text: string) => [text]);
  });

  it('renders the main Fullstack Garage logo and ordered maintenance details', async () => {
    const result = await new JsPdfServiceRecordRenderer().render(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(Blob);
    }
    expect(constructor).toHaveBeenCalledWith({ format: 'a4', orientation: 'p', unit: 'mm' });
    expect(pdf.addImage).toHaveBeenCalledWith(expect.any(String), 'PNG', 14, 12, 38, 12);
    expect(pdf.text).toHaveBeenCalledWith('SERVICE RECORD', 14, 35);
    expect(pdf.text).toHaveBeenCalledWith('SR-000001', 14, 43);
    expect(pdf.text).not.toHaveBeenCalledWith('Generated: 2026-07-22T12:00:00.000Z', expect.any(Number), expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith('Inspection', 14, expect.any(Number));
    expect(pdf.text).toHaveBeenCalledWith('Oil filter', 14, expect.any(Number));

    const textCalls = pdf.text.mock.calls as readonly (readonly unknown[])[];
    const itemTexts = textCalls
      .map(([value]) => value)
      .filter((value): value is string => value === 'Inspection' || value === 'Oil filter');
    expect(itemTexts).toEqual(['Inspection', 'Oil filter']);
    expect(pdf.text).toHaveBeenCalledWith('Total Parts & Consumables: $45.00', 14, expect.any(Number));
  });

  it('returns a safe temporary failure when the PDF library rejects rendering', async () => {
    pdf.output.mockImplementationOnce(() => {
      throw new Error('unexpected PDF failure');
    });

    await expect(new JsPdfServiceRecordRenderer().render(snapshot)).resolves.toMatchObject({
      ok: false,
      error: { category: 'temporary_failure' },
    });
  });
});
