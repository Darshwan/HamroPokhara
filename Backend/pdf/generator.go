package pdf

import (
	"bytes"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/skip2/go-qrcode"

	"pratibimba/internal/models"
)

// ── Color Palette ────────────────────────────────────────────
// Government document colors — formal, trustworthy
var (
	colorNavy      = [3]int{0, 51, 102}    // Header background
	colorGold      = [3]int{180, 140, 40}  // Accent / borders
	colorDarkGray  = [3]int{50, 50, 50}    // Body text
	colorMedGray   = [3]int{100, 100, 100} // Secondary text
	colorLightGray = [3]int{240, 240, 240} // Section backgrounds
	colorWhite     = [3]int{255, 255, 255}
	colorGreen     = [3]int{0, 120, 60} // Valid stamp color
	colorRed       = [3]int{180, 0, 0}  // Alert color
)

// fontPath returns the path to Devanagari font files.
// For hackathon: download NotoSansDevanagari-Regular.ttf
// and NotoSansDevanagari-Bold.ttf into assets/fonts/
func fontDir() string {
	if dir := os.Getenv("FONT_DIR"); dir != "" {
		return dir
	}
	return "./assets/fonts"
}

// Generate creates a complete Sifaris PDF from the given data.
// Returns PDF bytes ready to stream to the client.
func Generate(req *models.PDFRequest) (*models.PDFResult, error) {

	// ── Initialize FPDF ──────────────────────────────────────
	pdf := fpdf.New("P", "mm", "A4", fontDir())
	// A4 portrait: 210mm wide × 297mm tall

	// ── Load Devanagari fonts ────────────────────────────────
	// NotoSansDevanagari supports full Nepali Unicode
	regularFont := "NotoSansDevanagari-Regular.ttf"
	boldFont := "NotoSansDevanagari-Bold.ttf"

	if _, err := os.Stat(filepath.Join(fontDir(), boldFont)); err != nil {
		boldFont = regularFont
	}

	pdf.AddUTF8Font("Devanagari", "", regularFont)
	pdf.AddUTF8Font("DevanagariB", "B", boldFont)

	// ── Page settings ────────────────────────────────────────
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// ── Build the document section by section ────────────────
	drawBorder(pdf)
	drawHeader(pdf, req)
	drawDivider(pdf, colorGold)
	drawDocumentTitle(pdf, req.DocumentType)
	drawDivider(pdf, colorGold)
	drawDTIDBar(pdf, req)
	drawCitizenDetails(pdf, req)
	drawPurposeSection(pdf, req)
	drawBodyText(pdf, req)
	drawValiditySection(pdf, req)
	drawQRSection(pdf, req)
	drawOfficerSection(pdf, req)
	drawPratibimbaFooter(pdf, req)

	// ── Output to bytes ──────────────────────────────────────
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output failed: %w", err)
	}

	filename := fmt.Sprintf("sifaris_%s_%s.pdf",
		req.DTID,
		time.Now().Format("20060102"),
	)

	return &models.PDFResult{
		Bytes:     buf.Bytes(),
		Filename:  filename,
		PageCount: pdf.PageCount(),
	}, nil
}

// ── Section Drawers ──────────────────────────────────────────

// drawBorder draws the outer decorative border of the document
func drawBorder(pdf *fpdf.Fpdf) {
	// Outer border — navy
	setDrawColor(pdf, colorNavy)
	pdf.SetLineWidth(1.2)
	pdf.Rect(8, 8, 194, 281, "D")

	// Inner border — gold (thin)
	setDrawColor(pdf, colorGold)
	pdf.SetLineWidth(0.4)
	pdf.Rect(10, 10, 190, 277, "D")
}

// drawHeader draws the government letterhead at the top
func drawHeader(pdf *fpdf.Fpdf, req *models.PDFRequest) {

	// ── Navy header background ───────────────────────────────
	setFillColor(pdf, colorNavy)
	pdf.Rect(10, 10, 190, 42, "F")

	// ── Office name — large centered ────────────────────────
	setTextColor(pdf, colorWhite)
	pdf.SetFont("DevanagariB", "B", 16)
	pdf.SetXY(15, 15)
	pdf.CellFormat(180, 8, req.OfficeName, "", 1, "C", false, 0, "")

	// ── Sub-title: Ward office ───────────────────────────────
	pdf.SetFont("DevanagariB", "B", 12)
	pdf.SetXY(15, 24)
	pdf.CellFormat(180, 7,
		fmt.Sprintf("वडा कार्यालय — वडा नं. %s", req.WardNumber),
		"", 1, "C", false, 0, "")

	// ── District and Province ────────────────────────────────
	pdf.SetFont("Devanagari", "", 10)
	pdf.SetXY(15, 32)
	pdf.CellFormat(180, 6,
		fmt.Sprintf("%s, %s", req.DistrictName, req.ProvinceName),
		"", 1, "C", false, 0, "")

	// ── Office contact info row ──────────────────────────────
	setFillColor(pdf, colorGold)
	pdf.Rect(10, 52, 190, 8, "F")

	setTextColor(pdf, colorNavy)
	pdf.SetFont("Devanagari", "", 8)
	pdf.SetXY(15, 53.5)
	pdf.CellFormat(85, 5,
		fmt.Sprintf("फोन: %s", req.OfficePhone),
		"", 0, "L", false, 0, "")
	pdf.SetX(110)
	pdf.CellFormat(85, 5,
		fmt.Sprintf("इमेल: %s", req.OfficeEmail),
		"", 1, "R", false, 0, "")
}

// drawDocumentTitle draws the centered document type heading
func drawDocumentTitle(pdf *fpdf.Fpdf, docType string) {
	title := documentTypeToNepali(docType)

	setTextColor(pdf, colorNavy)
	pdf.SetFont("DevanagariB", "B", 15)
	pdf.SetXY(15, 67)
	pdf.CellFormat(180, 10, title, "", 1, "C", false, 0, "")
}

// drawDTIDBar draws the DTID and issue info in a highlighted bar
func drawDTIDBar(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	setFillColor(pdf, colorLightGray)
	pdf.Rect(15, 82, 180, 14, "F")

	// Left: DTID
	setTextColor(pdf, colorNavy)
	pdf.SetFont("DevanagariB", "B", 8)
	pdf.SetXY(18, 83.5)
	pdf.CellFormat(60, 5, "प्रमाण संख्या (DTID):", "", 1, "L", false, 0, "")

	pdf.SetFont("Devanagari", "", 8)
	pdf.SetXY(18, 88.5)
	pdf.CellFormat(90, 5, req.DTID, "", 0, "L", false, 0, "")

	// Right: Issue date and time
	pdf.SetFont("DevanagariB", "B", 8)
	pdf.SetXY(120, 83.5)
	pdf.CellFormat(70, 5, "जारी मिति/समय:", "", 1, "R", false, 0, "")

	pdf.SetFont("Devanagari", "", 8)
	pdf.SetXY(120, 88.5)
	pdf.CellFormat(70, 5,
		fmt.Sprintf("%s  |  %s", req.IssuedDateBS, req.IssuedTimeNP),
		"", 0, "R", false, 0, "")

	// Hash (short — first 16 chars)
	shortHash := req.DocumentHash
	if len(shortHash) > 16 {
		shortHash = shortHash[:16] + "..."
	}
	pdf.SetFont("Devanagari", "", 7)
	setTextColor(pdf, colorMedGray)
	pdf.SetXY(18, 94)
	pdf.CellFormat(180, 4,
		fmt.Sprintf("कागज Hash: %s", shortHash),
		"", 1, "L", false, 0, "")
}

// drawCitizenDetails draws the citizen information table
func drawCitizenDetails(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	pdf.SetXY(15, 102)

	// Section heading
	setFillColor(pdf, colorNavy)
	pdf.Rect(15, 102, 180, 7, "F")
	setTextColor(pdf, colorWhite)
	pdf.SetFont("DevanagariB", "B", 10)
	pdf.SetXY(18, 103)
	pdf.CellFormat(174, 5, "व्यक्तिगत विवरण", "", 1, "L", false, 0, "")

	// Details rows
	y := 112.0
	details := [][]string{
		{"पूरा नाम:", req.CitizenName},
		{"नागरिकता नं.:", req.CitizenNID},
		{"जन्म मिति:", req.CitizenDOB},
		{"लिङ्ग:", req.CitizenGender},
		{"बाबुको नाम:", req.FatherName},
		{"आमाको नाम:", req.MotherName},
		{"स्थायी ठेगाना:", req.CitizenAddress},
	}

	for i, row := range details {
		// Alternating row background
		if i%2 == 0 {
			setFillColor(pdf, colorLightGray)
			pdf.Rect(15, y-1, 180, 7, "F")
		}

		setTextColor(pdf, colorNavy)
		pdf.SetFont("DevanagariB", "B", 9)
		pdf.SetXY(18, y)
		pdf.CellFormat(50, 6, row[0], "", 0, "L", false, 0, "")

		setTextColor(pdf, colorDarkGray)
		pdf.SetFont("Devanagari", "", 9)
		pdf.SetX(68)
		pdf.CellFormat(120, 6, row[1], "", 1, "L", false, 0, "")

		y += 7
	}
}

// drawPurposeSection draws the purpose/reason section
func drawPurposeSection(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	y := pdf.GetY() + 5

	// Section heading
	setFillColor(pdf, colorNavy)
	pdf.Rect(15, y, 180, 7, "F")
	setTextColor(pdf, colorWhite)
	pdf.SetFont("DevanagariB", "B", 10)
	pdf.SetXY(18, y+1)
	pdf.CellFormat(174, 5, "सिफारिसको उद्देश्य", "", 1, "L", false, 0, "")

	y += 10
	setFillColor(pdf, colorLightGray)
	pdf.Rect(15, y, 180, 12, "F")

	setTextColor(pdf, colorDarkGray)
	pdf.SetFont("Devanagari", "", 10)
	pdf.SetXY(18, y+2)
	pdf.MultiCell(174, 6, req.Purpose, "", "L", false)

	if req.AdditionalInfo != "" {
		pdf.SetFont("Devanagari", "", 9)
		setTextColor(pdf, colorMedGray)
		pdf.SetXY(18, pdf.GetY()+1)
		pdf.MultiCell(174, 5, req.AdditionalInfo, "", "L", false)
	}
}

// drawBodyText draws the formal Sifaris body paragraph
func drawBodyText(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	y := pdf.GetY() + 6

	setTextColor(pdf, colorDarkGray)
	pdf.SetFont("Devanagari", "", 10)
	pdf.SetXY(15, y)

	body := fmt.Sprintf(
		"माथि उल्लेखित %s यस वडाका स्थायी बासिन्दा हुनुहुन्छ भन्ने "+
			"कुरा यस वडा कार्यालयको अभिलेखबाट प्रमाणित हुन आएकोले "+
			"उहाँलाई %s को लागि सिफारिस गरिन्छ। "+
			"सम्बन्धित निकायले आवश्यक कारबाही गरिदिनु हुन अनुरोध छ।",
		req.CitizenName,
		req.Purpose,
	)

	pdf.MultiCell(180, 6, body, "", "J", false)
}

// drawValiditySection draws the validity period warning box
func drawValiditySection(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	y := pdf.GetY() + 4

	// Gold border box
	setDrawColor(pdf, colorGold)
	setFillColor(pdf, [3]int{255, 251, 230}) // very light yellow
	pdf.SetLineWidth(0.6)
	pdf.Rect(15, y, 180, 10, "FD")

	setTextColor(pdf, colorRed)
	pdf.SetFont("DevanagariB", "B", 9)
	pdf.SetXY(18, y+1.5)
	pdf.CellFormat(60, 6, "मान्यता अवधि:", "", 0, "L", false, 0, "")

	setTextColor(pdf, colorDarkGray)
	pdf.SetFont("Devanagari", "", 9)
	pdf.SetX(60)
	pdf.CellFormat(130, 6,
		fmt.Sprintf("यो सिफारिस %s सम्म मात्र मान्य हुनेछ।",
			req.ValidUntilBS),
		"", 0, "L", false, 0, "")
}

// drawQRSection draws the QR code and verification URL
func drawQRSection(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	y := pdf.GetY() + 6

	// ── Generate QR code as PNG bytes ────────────────────────
	qrBytes, err := qrcode.Encode(req.VerifyURL, qrcode.High, 256)
	if err != nil {
		// If QR fails, draw placeholder box and continue
		drawQRPlaceholder(pdf, y)
		return
	}

	// Register PNG image from bytes
	imgOpts := fpdf.ImageOptions{
		ImageType: "PNG",
		ReadDpi:   true,
	}
	imgReader := bytes.NewReader(qrBytes)

	// Validate it's a valid PNG
	if _, err := png.Decode(bytes.NewReader(qrBytes)); err != nil {
		drawQRPlaceholder(pdf, y)
		return
	}

	// ── QR section layout ────────────────────────────────────
	// QR on the right, verification text on the left

	// Left side — verification instructions
	setTextColor(pdf, colorNavy)
	pdf.SetFont("DevanagariB", "B", 9)
	pdf.SetXY(15, y)
	pdf.CellFormat(120, 6, "डिजिटल प्रमाणीकरण", "", 1, "L", false, 0, "")

	setTextColor(pdf, colorDarkGray)
	pdf.SetFont("Devanagari", "", 8)
	pdf.SetXY(15, y+7)
	pdf.MultiCell(115, 5,
		"यो कागज PRATIBIMBA राष्ट्रिय प्रणालीमा दर्ता छ। "+
			"दायाँतर्फको QR कोड स्क्यान गरेर वा तलको URL मा "+
			"गएर यो कागजको प्रामाणिकता तुरुन्त जाँच गर्न सकिन्छ।",
		"", "L", false)

	// Verification URL box
	urlY := pdf.GetY() + 2
	setFillColor(pdf, colorLightGray)
	setDrawColor(pdf, colorNavy)
	pdf.SetLineWidth(0.3)
	pdf.Rect(15, urlY, 115, 8, "FD")

	setTextColor(pdf, colorNavy)
	pdf.SetFont("Devanagari", "", 7)
	pdf.SetXY(17, urlY+1.5)
	pdf.CellFormat(111, 5, "URL: "+req.VerifyURL, "", 0, "L", false, 0, "")

	// PRATIBIMBA branding under URL
	pdf.SetFont("Devanagari", "", 7)
	setTextColor(pdf, colorGreen)
	pdf.SetXY(15, urlY+10)
	pdf.CellFormat(115, 5,
		"PRATIBIMBA राष्ट्रिय अखण्डता प्रणालीद्वारा सुरक्षित",
		"", 0, "L", false, 0, "")

	// Right side — QR code image
	// Place at right side, aligned with section start
	pdf.RegisterImageOptionsReader("qr_"+req.DTID, imgOpts, imgReader)
	pdf.ImageOptions(
		"qr_"+req.DTID,
		155, y, // X, Y position
		35, 35, // Width, Height in mm
		false, imgOpts, 0, "",
	)

	// "QR स्क्यान गर्नुस्" label under QR
	setTextColor(pdf, colorMedGray)
	pdf.SetFont("Devanagari", "", 7)
	pdf.SetXY(155, y+36)
	pdf.CellFormat(35, 4, "QR स्क्यान गर्नुस्", "", 0, "C", false, 0, "")
}

// drawQRPlaceholder draws a box if QR generation fails
func drawQRPlaceholder(pdf *fpdf.Fpdf, y float64) {
	setDrawColor(pdf, colorNavy)
	pdf.SetLineWidth(0.5)
	pdf.Rect(155, y, 35, 35, "D")
	setTextColor(pdf, colorMedGray)
	pdf.SetFont("Devanagari", "", 7)
	pdf.SetXY(155, y+16)
	pdf.CellFormat(35, 5, "QR", "", 0, "C", false, 0, "")
}

// drawOfficerSection draws the signature and stamp section
func drawOfficerSection(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	y := pdf.GetY() + 10

	// ── Left: Stamp area ─────────────────────────────────────
	setDrawColor(pdf, colorGold)
	pdf.SetLineWidth(0.5)
	pdf.SetDashPattern([]float64{2, 1}, 0)
	pdf.Rect(20, y, 50, 30, "D")
	pdf.SetDashPattern([]float64{}, 0) // reset dash

	setTextColor(pdf, colorMedGray)
	pdf.SetFont("Devanagari", "", 8)
	pdf.SetXY(20, y+13)
	pdf.CellFormat(50, 5, "कार्यालयको छाप", "", 0, "C", false, 0, "")

	// ── Right: Signature area ─────────────────────────────────
	signX := 120.0

	// Signature line
	setDrawColor(pdf, colorDarkGray)
	pdf.SetLineWidth(0.4)
	pdf.Line(signX, y+25, signX+65, y+25)

	// Officer name
	setTextColor(pdf, colorDarkGray)
	pdf.SetFont("DevanagariB", "B", 9)
	pdf.SetXY(signX, y+26)
	pdf.CellFormat(65, 5, req.OfficerName, "", 1, "C", false, 0, "")

	// Designation
	pdf.SetFont("Devanagari", "", 8)
	setTextColor(pdf, colorMedGray)
	pdf.SetXY(signX, y+31)
	pdf.CellFormat(65, 5, req.OfficerDesig, "", 1, "C", false, 0, "")

	// Ward
	pdf.SetXY(signX, y+36)
	pdf.CellFormat(65, 5,
		fmt.Sprintf("वडा नं. %s, %s", req.WardNumber, req.DistrictName),
		"", 1, "C", false, 0, "")
}

// drawPratibimbaFooter draws the bottom security footer
func drawPratibimbaFooter(pdf *fpdf.Fpdf, req *models.PDFRequest) {
	// Position at bottom of page
	pdf.SetXY(10, 270)

	// Full-width footer background
	setFillColor(pdf, colorNavy)
	pdf.Rect(10, 270, 190, 18, "F")

	// Top line of footer — PRATIBIMBA branding
	setTextColor(pdf, colorGold)
	pdf.SetFont("DevanagariB", "B", 8)
	pdf.SetXY(15, 271.5)
	pdf.CellFormat(180, 5,
		"PRATIBIMBA — राष्ट्रिय कागज अखण्डता तथा प्रमाणीकरण प्रणाली",
		"", 1, "C", false, 0, "")

	// Second line — DTID and hash reference
	setTextColor(pdf, colorWhite)
	pdf.SetFont("Devanagari", "", 7)
	pdf.SetXY(15, 277)
	pdf.CellFormat(90, 4,
		fmt.Sprintf("DTID: %s", req.DTID),
		"", 0, "L", false, 0, "")
	pdf.SetX(110)
	pdf.CellFormat(85, 4,
		fmt.Sprintf("जारी: %s  |  मान्य: %s सम्म",
			req.IssuedDateBS, req.ValidUntilBS),
		"", 0, "R", false, 0, "")

	// Third line — legal notice
	setTextColor(pdf, [3]int{180, 180, 180})
	pdf.SetFont("Devanagari", "", 6.5)
	pdf.SetXY(15, 282)
	pdf.CellFormat(180, 4,
		"यो कागज नेपाल सरकारको इलेक्ट्रोनिक कारोबार ऐन, २०६३ अन्तर्गत कानुनी मान्यता प्राप्त छ।",
		"", 0, "C", false, 0, "")
}

// drawDivider draws a horizontal divider line
func drawDivider(pdf *fpdf.Fpdf, color [3]int) {
	y := pdf.GetY() + 1
	setDrawColor(pdf, color)
	pdf.SetLineWidth(0.5)
	pdf.Line(15, y, 195, y)
	pdf.SetY(y + 2)
}

// ── Color Helpers ────────────────────────────────────────────

func setFillColor(pdf *fpdf.Fpdf, c [3]int) {
	pdf.SetFillColor(c[0], c[1], c[2])
}

func setTextColor(pdf *fpdf.Fpdf, c [3]int) {
	pdf.SetTextColor(c[0], c[1], c[2])
}

func setDrawColor(pdf *fpdf.Fpdf, c [3]int) {
	pdf.SetDrawColor(c[0], c[1], c[2])
}

// ── Document Type Translator ─────────────────────────────────

func documentTypeToNepali(docType string) string {
	switch docType {
	case "SIFARIS":
		return "सिफारिस पत्र"
	case "TAX_CLEARANCE":
		return "कर चुक्ता प्रमाणपत्र"
	case "BIRTH_CERTIFICATE":
		return "जन्मदर्ता प्रमाणपत्र"
	case "DEATH_CERTIFICATE":
		return "मृत्युदर्ता प्रमाणपत्र"
	case "RELATIONSHIP_CERT":
		return "नाता प्रमाणित पत्र"
	case "INCOME_PROOF":
		return "आय प्रमाण पत्र"
	case "BUSINESS_REGISTRATION":
		return "व्यवसाय दर्ता प्रमाणपत्र"
	case "LAND_REGISTRATION":
		return "जग्गा दर्ता प्रमाणपत्र"
	case "CONTRACT_AWARD":
		return "ठेक्का स्वीकृति पत्र"
	default:
		return "सरकारी कागज"
	}
}

// ── Nepali Date Helpers ──────────────────────────────────────

// NepaliMonths maps month numbers to Nepali month names
var NepaliMonths = map[int]string{
	1: "बैशाख", 2: "जेठ", 3: "असार",
	4: "श्रावण", 5: "भाद्र", 6: "असोज",
	7: "कार्तिक", 8: "मंसिर", 9: "पुस",
	10: "माघ", 11: "फाल्गुन", 12: "चैत्र",
}

// FormatNepaliDate formats a time.Time as a Nepali BS date string.
// Uses approximate conversion — replace with full BS calendar in production.
// Returns format: "२०८२ भाद्र १५"
func FormatNepaliDate(t time.Time) string {
	// Approximate BS year (proper conversion needs full calendar lookup)
	bsYear := t.Year() + 57
	month := int(t.Month())
	day := t.Day()

	monthName := NepaliMonths[month]
	if monthName == "" {
		monthName = fmt.Sprintf("महिना %d", month)
	}

	return fmt.Sprintf("%s %s %s",
		toDevanagariNumerals(bsYear),
		monthName,
		toDevanagariNumerals(day),
	)
}

// FormatNepaliTime formats time as Nepali time string
// Returns format: "दिउसो २:३५"
func FormatNepaliTime(t time.Time) string {
	hour := t.Hour()
	min := t.Minute()

	period := "बिहान"
	displayHour := hour

	switch {
	case hour >= 0 && hour < 4:
		period = "राति"
	case hour >= 4 && hour < 12:
		period = "बिहान"
	case hour == 12:
		period = "दिउसो"
		displayHour = 12
	case hour > 12 && hour < 17:
		period = "दिउसो"
		displayHour = hour - 12
	case hour >= 17 && hour < 20:
		period = "साँझ"
		displayHour = hour - 12
	default:
		period = "राति"
		displayHour = hour - 12
	}

	return fmt.Sprintf("%s %s:%s",
		period,
		toDevanagariNumerals(displayHour),
		toDevanagariNumerals(min),
	)
}

// toDevanagariNumerals converts an integer to Devanagari numeral string
func toDevanagariNumerals(n int) string {
	devanagari := []rune{'०', '१', '२', '३', '४', '५', '६', '७', '८', '९'}
	s := fmt.Sprintf("%d", n)
	result := make([]rune, len(s))
	for i, ch := range s {
		if ch >= '0' && ch <= '9' {
			result[i] = devanagari[ch-'0']
		} else {
			result[i] = ch
		}
	}
	return string(result)
}

// FormatValidUntil returns a date 30 days after issuance in Nepali format
func FormatValidUntil(issuedAt time.Time) string {
	validUntil := issuedAt.AddDate(0, 0, 30)
	return FormatNepaliDate(validUntil)
}
