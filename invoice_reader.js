import fs from 'node:fs/promises';
import pdf from 'pdf-parse';

const pdfFilePath = './Chelsea_Sample_Invoice_1.pdf';
const outputPath = './invoice_data.json';

const getMatch = (text, regex) => {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
};

async function extractInvoiceData() {
  try {
    const dataBuffer = await fs.readFile(pdfFilePath);
    const data = await pdf(dataBuffer);
    let text = data.text.replace(/\r/g, '').replace(/\s+/g, ' ').trim();

    console.log('✅ PDF Parsed Successfully\n');

    // ---- Header fields ----
    const customerName = getMatch(
      text,
      /CUSTOMER\s*NAME\s*[:\-]?\s*(.+?)(?=\s*DUE\s*DATE|TIN|ADDRESS|$)/i
    );
    const dueDate = getMatch(text, /DUE\s*DATE\s*[:\-]?\s*([0-9/.\-]+)/i);
    const accountNo = getMatch(text, /AC\s*NO\.?\s*[:\-]?\s*([0-9\-]+)/i);

    // ---- Line items section ----
    const sectionMatch = text.match(
      /NO\.? *DESCRIPTION *UOM *QTY *UNIT *PRICE *AMOUNT\s+([\s\S]*?)(?:VATABLE SALES|TOTAL SALES|AMOUNT DUE|AMOUNT TO PAY)/i
    );
    const lineSection = sectionMatch ? sectionMatch[1].trim() : '';

    console.log('\n🧾 LINE SECTION RAW:\n', lineSection);

    const lineItems = [];

    if (lineSection) {
      const itemRegex =
        /(\d+)\s*([A-Z0-9\s,.'\-]+?)\s*([\d,]+\.\d{2})\s*P?\s*([\d,]+\.\d{2})/gi;
      let m;

      const KNOWN_UOMS = ['ACT UNIT', 'UNIT', 'BAG', 'PCS', 'PC', 'EA'];

      while ((m = itemRegex.exec(lineSection)) !== null) {
        const lineNo = parseInt(m[1], 10);
        let description = m[2].trim();

        // 💡 Insert space between lowercase→uppercase (fixes "FEEAct" → "FEE Act")
        description = description.replace(/([a-z])([A-Z])/g, '$1 $2').trim();

        let unitPrice = m[3].trim();
        const amount = m[4].trim();

        // Fix accidental merge like "1224,000.00"
        if (unitPrice.length === amount.length + 1 && unitPrice.endsWith(amount)) {
          unitPrice = amount;
        }

        // --- UOM extraction ---
        let uom = null;
        const upperDesc = description.toUpperCase().replace(/\s+/g, ' ');

        for (const candidate of KNOWN_UOMS) {
          const idx = upperDesc.lastIndexOf(candidate);
          if (idx !== -1 && idx >= upperDesc.length - candidate.length - 1) {
            uom = candidate;
            description = description.slice(0, idx).trim();
            break;
          }
        }

        const quantity = 1;

        lineItems.push({
          lineNo,
          itemName: description,
          uom,
          quantity,
          unitPrice,
          amount,
        });
      }
    }

    // ✅ Clean up any stray punctuation after extraction
    const cleanedCustomerName = customerName
      ? customerName.replace(/\s*[:\-]+$/, '').trim()
      : null;

    const invoiceData = {
      customerName: cleanedCustomerName,
      dueDate,
      accountNo,
      lineItems,
    };

    console.log('\n📦 Extracted Invoice Data:\n', invoiceData);

    await fs.writeFile(outputPath, JSON.stringify(invoiceData, null, 2), 'utf8');
    console.log(`\n💾 Saved extracted data to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error extracting invoice data:', error);
  }
}

extractInvoiceData();
