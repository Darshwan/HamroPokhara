package pdf

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"time"

	gofpdf "github.com/go-pdf/fpdf"
	"github.com/skip2/go-qrcode"

	"pratibimba/internal/models"
)

const (
	pgW  = 210.0
	pgH  = 297.0
	mL   = 12.0
	mR   = 12.0
	mT   = 10.0
	body = pgW - mL - mR
)

type RGB struct{ R, G, B int }

var (
	cNavy   = RGB{0, 59, 90}
	cGold   = RGB{200, 168, 75}
	cLGray  = RGB{240, 244, 242}
	cMGray  = RGB{120, 145, 135}
	cDGray  = RGB{30, 30, 30}
	cWhite  = RGB{255, 255, 255}
	cGreen  = RGB{34, 120, 74}
	cRed    = RGB{176, 42, 30}
	cGoldBg = RGB{255, 252, 232}
	cBlue   = RGB{232, 244, 253}
)

func fontDir() string {
	if dir := os.Getenv("FONT_DIR"); dir != "" {
		return dir
	}
	return "./assets/fonts"
}

func Generate(req *models.PDFRequest) (*models.PDFResult, error) {
	f := gofpdf.New("P", "mm", "A4", "")

	registerFonts(f, fontDir())

	f.SetMargins(mL, mT, mR)
	f.SetAutoPageBreak(false, 0)
	f.AddPage()

	y := mT
	y = drawBorder(f, y)
	y = drawHeader(f, req, y)
	y = drawGoldStrip(f, req, y)
	y = drawTitle(f, req, y)
	y = drawDTIDBar(f, req, y)
	y = drawSectionHeading(f, "व्यक्तिगत विवरण", y)
	y = drawDetailsTable(f, req, y)
	y = drawSectionHeading(f, "सिफारिसको उद्देश्य", y)
	y = drawPurposeBox(f, req, y)
	y = drawBodyParagraph(f, req, y)
	y = drawValidityBox(f, req, y)
	y = drawQRSection(f, req, y)
	drawOfficerSection(f, req, y)
	drawFooter(f, req)

	var buf bytes.Buffer
	if err := f.Output(&buf); err != nil {
		return nil, fmt.Errorf("PDF output error: %w", err)
	}

	b := buf.Bytes()
	filename := fmt.Sprintf("sifaris_%s_%s.pdf", req.DTID, time.Now().Format("20060102"))

	return &models.PDFResult{
		Bytes:     b,
		Filename:  filename,
		PageCount: f.PageCount(),
	}, nil
}

func registerFonts(f *gofpdf.Fpdf, dir string) {
	notoReg := filepath.Join(dir, "NotoSansDevanagari-Regular.ttf")
	notoBold := filepath.Join(dir, "NotoSansDevanagari-Bold.ttf")

	freeReg := filepath.Join(dir, "FreeSerif.ttf")
	freeBold := filepath.Join(dir, "FreeSerifBold.ttf")

	sysFreeReg := "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
	sysFreeBold := "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
	coreReg := ""
	coreBold := ""

	npRegistered := false
	for _, pair := range [][2]string{{notoReg, notoBold}, {freeReg, freeBold}, {sysFreeReg, sysFreeBold}} {
		reg := pair[0]
		bold := pair[1]
		if !fileExists(reg) {
			continue
		}
		if !fileExists(bold) {
			bold = reg
		}
		f.AddUTF8Font("NP", "", reg)
		f.AddUTF8Font("NPB", "", bold)
		coreReg = reg
		coreBold = bold
		npRegistered = true
		break
	}

	interReg := filepath.Join(dir, "Inter-Regular.ttf")
	interBold := filepath.Join(dir, "Inter-Bold.ttf")
	poppReg := "/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf"
	poppBold := "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
	winNirmalaReg := "C:/Windows/Fonts/Nirmala.ttf"
	winNirmalaBold := "C:/Windows/Fonts/NirmalaB.ttf"
	winArialReg := "C:/Windows/Fonts/arial.ttf"
	winArialBold := "C:/Windows/Fonts/arialbd.ttf"

	if fileExists(interReg) {
		if !fileExists(interBold) {
			interBold = interReg
		}
		f.AddUTF8Font("LT", "", interReg)
		f.AddUTF8Font("LTB", "", interBold)
		return
	}

	if fileExists(poppReg) {
		if !fileExists(poppBold) {
			poppBold = poppReg
		}
		f.AddUTF8Font("LT", "", poppReg)
		f.AddUTF8Font("LTB", "", poppBold)
		return
	}

	if fileExists(sysFreeReg) {
		if !fileExists(sysFreeBold) {
			sysFreeBold = sysFreeReg
		}
		f.AddUTF8Font("LT", "", sysFreeReg)
		f.AddUTF8Font("LTB", "", sysFreeBold)
		if !npRegistered {
			f.AddUTF8Font("NP", "", sysFreeReg)
			f.AddUTF8Font("NPB", "", sysFreeBold)
		}
		return
	}

	if fileExists(winArialReg) {
		if !fileExists(winArialBold) {
			winArialBold = winArialReg
		}
		f.AddUTF8Font("LT", "", winArialReg)
		f.AddUTF8Font("LTB", "", winArialBold)
		if !npRegistered && fileExists(winNirmalaReg) {
			if !fileExists(winNirmalaBold) {
				winNirmalaBold = winNirmalaReg
			}
			f.AddUTF8Font("NP", "", winNirmalaReg)
			f.AddUTF8Font("NPB", "", winNirmalaBold)
		}
		return
	}

	if npRegistered {
		// Reuse Nepali-capable font for Latin aliases as a safe fallback.
		f.AddUTF8Font("LT", "", coreReg)
		f.AddUTF8Font("LTB", "", coreBold)
		return
	}

	// Final fallback when no TTF is available anywhere.
	f.SetFont("Helvetica", "", 10)
}

func drawBorder(f *gofpdf.Fpdf, y float64) float64 {
	setDraw(f, cNavy)
	f.SetLineWidth(0.7)
	f.Rect(4, 4, pgW-8, pgH-8, "D")
	setDraw(f, cGold)
	f.SetLineWidth(0.3)
	f.Rect(6.5, 6.5, pgW-13, pgH-13, "D")
	f.SetLineWidth(0.3)
	return y
}

func drawHeader(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const h = 32.0
	setFill(f, cNavy)
	f.Rect(6.5, y, pgW-13, h, "F")

	setFill(f, cGold)
	f.Circle(mL+11, y+h/2, 9, "F")
	setText(f, cNavy)
	f.SetFont("LTB", "", 4.5)
	f.SetXY(mL+6, y+h/2-2.5)
	f.CellFormat(10, 3, "NEPAL GOVT", "", 0, "C", false, 0, "")

	setText(f, cWhite)
	f.SetFont("NPB", "", 11.5)
	f.SetXY(mL+25, y+6)
	f.CellFormat(body-25, 7, req.OfficeName, "", 1, "C", false, 0, "")

	f.SetFont("NP", "", 8.5)
	f.SetXY(mL+25, y+14)
	f.CellFormat(body-25, 5, fmt.Sprintf("वडा नं. %s", req.WardNumber), "", 1, "C", false, 0, "")

	setText(f, cGold)
	f.SetFont("NP", "", 7.5)
	f.SetXY(mL+25, y+20)
	f.CellFormat(body-25, 5, req.DistrictName+" — "+req.ProvinceName, "", 1, "C", false, 0, "")

	return y + h
}

func drawGoldStrip(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const h = 6.5
	setFill(f, cGold)
	f.Rect(6.5, y, pgW-13, h, "F")
	setText(f, cNavy)
	f.SetFont("LT", "", 6.5)
	f.SetXY(mL, y+1.2)
	f.CellFormat(body, 4, "Phone: "+req.OfficePhone+" | Email: "+req.OfficeEmail, "", 0, "C", false, 0, "")
	return y + h + 2
}

func drawTitle(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	setText(f, cNavy)
	f.SetFont("NPB", "", 13)
	f.SetXY(mL, y)
	f.CellFormat(body, 8, documentTypeToNepali(req.DocumentType), "", 1, "C", false, 0, "")

	setDraw(f, cGold)
	f.SetLineWidth(0.8)
	mid := pgW / 2
	f.Line(mid-25, y+9, mid+25, y+9)
	f.SetLineWidth(0.3)
	return y + 13
}

func drawDTIDBar(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const h = 10.5
	setFill(f, cLGray)
	setDraw(f, cNavy)
	f.SetLineWidth(0.25)
	f.Rect(mL, y, body, h, "FD")

	setText(f, cNavy)
	f.SetFont("LTB", "", 7)
	f.SetXY(mL+2, y+1.5)
	f.CellFormat(50, 4, "DTID:", "", 0, "L", false, 0, "")
	f.SetFont("LT", "", 7)
	f.SetX(mL + 14)
	f.CellFormat(90, 4, req.DTID, "", 0, "L", false, 0, "")

	setText(f, cMGray)
	f.SetFont("LT", "", 5.5)
	shortH := req.DocumentHash
	if len(shortH) > 20 {
		shortH = shortH[:20] + "..."
	}
	f.SetXY(mL+2, y+6)
	f.CellFormat(90, 3, "SHA-256: "+shortH, "", 0, "L", false, 0, "")

	setText(f, cNavy)
	f.SetFont("NP", "", 6.5)
	f.SetXY(mL, y+1.5)
	f.CellFormat(body-2, 4, "मिति: "+req.IssuedDateBS, "", 1, "R", false, 0, "")
	f.SetFont("NP", "", 6.5)
	f.SetXY(mL, y+6)
	f.CellFormat(body-2, 3, "समय: "+req.IssuedTimeNP, "", 0, "R", false, 0, "")

	return y + h + 3
}

func drawSectionHeading(f *gofpdf.Fpdf, title string, y float64) float64 {
	const h = 6.5
	setFill(f, cNavy)
	f.Rect(mL, y, body, h, "F")
	setText(f, cWhite)
	f.SetFont("NPB", "", 8.5)
	f.SetXY(mL+2, y+1)
	f.CellFormat(body-4, 5, title, "", 0, "L", false, 0, "")
	return y + h
}

func drawDetailsTable(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	type row struct{ Label, Value string }
	rows := []row{
		{"पूरा नाम (Full Name):", req.CitizenName},
		{"राष्ट्रिय परिचय / नागरिकता:", req.CitizenNID},
		{"जन्म मिति (DOB):", req.CitizenDOB},
		{"लिङ्ग (Gender):", req.CitizenGender},
		{"बाबुको नाम (Father):", req.FatherName},
		{"आमाको नाम (Mother):", req.MotherName},
		{"स्थायी ठेगाना (Address):", req.CitizenAddress},
	}

	const rowH = 6.0
	const lblW = 56.0
	const valW = body - lblW - 1

	for i, r := range rows {
		rowY := y + float64(i)*rowH
		if i%2 == 0 {
			setFill(f, cLGray)
			f.Rect(mL, rowY, body, rowH, "F")
		}
		setDraw(f, RGB{200, 214, 210})
		f.SetLineWidth(0.2)
		f.Line(mL, rowY, mL+body, rowY)
		f.Line(mL+lblW, rowY, mL+lblW, rowY+rowH)

		setText(f, cNavy)
		f.SetFont("NPB", "", 7)
		f.SetXY(mL+2, rowY+1.5)
		f.CellFormat(lblW-3, 4, r.Label, "", 0, "L", false, 0, "")

		setText(f, cDGray)
		f.SetFont("NP", "", 7)
		f.SetXY(mL+lblW+2, rowY+1.5)
		f.CellFormat(valW-2, 4, r.Value, "", 0, "L", false, 0, "")
	}

	return y + float64(len(rows))*rowH + 3
}

func drawPurposeBox(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const h = 16.0
	setFill(f, cBlue)
	setDraw(f, RGB{133, 183, 217})
	f.SetLineWidth(0.4)
	f.Rect(mL, y, body, h, "FD")

	setText(f, cNavy)
	f.SetFont("NPB", "", 8)
	f.SetXY(mL+3, y+2)
	f.CellFormat(30, 5, "उद्देश्य:", "", 0, "L", false, 0, "")
	f.SetFont("NP", "", 8)
	f.SetX(mL + 22)
	f.CellFormat(body-25, 5, req.Purpose, "", 1, "L", false, 0, "")

	setText(f, cDGray)
	f.SetFont("NP", "", 7.5)
	f.SetXY(mL+3, y+8)
	formal := req.AdditionalInfo
	if formal == "" {
		formal = req.Purpose
	}
	runes := []rune(formal)
	if len(runes) > 85 {
		formal = string(runes[:82]) + "..."
	}
	f.CellFormat(body-6, 5, formal, "", 0, "L", false, 0, "")

	return y + h + 3
}

func drawBodyParagraph(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	bodyText := fmt.Sprintf(
		"प्रस्तुत %s वडा नं. %s का स्थायी बासिन्दा भएको यस वडाको अभिलेखबाट प्रमाणित हुन आउँदा उहाँलाई माथि उल्लेखित उद्देश्यको लागि यो सिफारिस पत्र जारी गरिएको छ । सम्बन्धित निकायले आवश्यक सहयोग गरिदिनुहुन अनुरोध छ ।",
		req.CitizenName,
		req.WardNumber,
	)

	setText(f, cDGray)
	f.SetFont("NP", "", 8.5)
	f.SetXY(mL, y)
	f.MultiCell(body, 5, bodyText, "", "J", false)
	newY := f.GetY()

	return newY + 3
}

func drawValidityBox(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const h = 7.0
	setFill(f, cGoldBg)
	setDraw(f, cGold)
	f.SetLineWidth(0.5)
	f.Rect(mL, y, body, h, "FD")

	setText(f, cRed)
	f.SetFont("NPB", "", 7.5)
	f.SetXY(mL+3, y+1.5)
	f.CellFormat(25, 4, "मान्यता:", "", 0, "L", false, 0, "")

	valid := req.ValidUntilBS
	if valid == "" {
		valid = FormatValidUntil(req.IssuedAtUTC)
	}

	setText(f, cDGray)
	f.SetFont("NP", "", 7.5)
	f.SetX(mL + 30)
	f.CellFormat(100, 4, valid+" सम्म मात्र मान्य", "", 0, "L", false, 0, "")

	setText(f, cGreen)
	f.SetFont("NP", "", 7)
	f.SetX(mL + 130)
	f.CellFormat(body-133, 4, "PRATIBIMBA प्रमाणित", "", 0, "R", false, 0, "")

	return y + h + 4
}

func drawQRSection(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) float64 {
	const qrSize = 28.0
	qrX := mL + body - qrSize
	qrY := y

	verifyURL := req.VerifyURL
	if verifyURL == "" {
		verifyURL = "https://verify.pratibimba.gov.np/" + req.DTID
	}

	qrPNG, err := qrcode.Encode(verifyURL, qrcode.High, 256)
	if err == nil {
		imgName := "qr_" + req.DTID
		f.RegisterImageOptionsReader(
			imgName,
			gofpdf.ImageOptions{ImageType: "PNG"},
			bytes.NewReader(qrPNG),
		)
		f.ImageOptions(imgName, qrX, qrY, qrSize, qrSize, false,
			gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	} else {
		setDraw(f, cNavy)
		f.SetLineWidth(0.5)
		f.Rect(qrX, qrY, qrSize, qrSize, "D")
		setText(f, cMGray)
		f.SetFont("NP", "", 6)
		f.SetXY(qrX, qrY+11)
		f.CellFormat(qrSize, 5, "QR Code", "", 0, "C", false, 0, "")
	}

	setText(f, cNavy)
	f.SetFont("NPB", "", 8)
	f.SetXY(mL, y)
	f.CellFormat(body-qrSize-5, 5, "डिजिटल प्रमाणीकरण", "", 1, "L", false, 0, "")

	setText(f, cDGray)
	f.SetFont("NP", "", 7.5)
	f.SetXY(mL, y+6)
	f.CellFormat(body-qrSize-5, 4.5, "यो कागज PRATIBIMBA राष्ट्रिय प्रणालीमा दर्ता", "", 1, "L", false, 0, "")
	f.SetXY(mL, y+11)
	f.CellFormat(body-qrSize-5, 4.5, "छ । QR स्क्यान गरेर प्रमाणित गर्नुस् ।", "", 1, "L", false, 0, "")

	urlY := y + 17
	setFill(f, cLGray)
	setDraw(f, RGB{192, 212, 204})
	f.SetLineWidth(0.2)
	f.Rect(mL, urlY, body-qrSize-5, 5.5, "FD")
	setText(f, cNavy)
	f.SetFont("LT", "", 5.5)
	f.SetXY(mL+1.5, urlY+1)
	f.CellFormat(body-qrSize-8, 3.5, verifyURL, "", 0, "L", false, 0, "")

	setText(f, cGreen)
	f.SetFont("NP", "", 7)
	f.SetXY(mL, urlY+7)
	f.CellFormat(body-qrSize-5, 4, "PRATIBIMBA राष्ट्रिय अखण्डता प्रणालीद्वारा सुरक्षित", "", 0, "L", false, 0, "")

	return y + qrSize + 5
}

func drawOfficerSection(f *gofpdf.Fpdf, req *models.PDFRequest, y float64) {
	setDraw(f, cGold)
	f.SetLineWidth(0.5)
	f.SetDashPattern([]float64{2, 1.5}, 0)
	f.Rect(mL, y, 46, 24, "D")
	f.SetDashPattern([]float64{}, 0)
	setText(f, cMGray)
	f.SetFont("NP", "", 7)
	f.SetXY(mL, y+11)
	f.CellFormat(46, 5, "कार्यालयको छाप", "", 0, "C", false, 0, "")

	sigX := mL + body - 68.0
	setDraw(f, cDGray)
	f.SetLineWidth(0.4)
	f.Line(sigX, y+20, mL+body, y+20)

	setText(f, cNavy)
	f.SetFont("NPB", "", 8)
	f.SetXY(sigX, y+22)
	f.CellFormat(68, 5, req.OfficerName, "", 1, "C", false, 0, "")

	setText(f, cMGray)
	f.SetFont("NP", "", 7)
	f.SetXY(sigX, y+27)
	desig := req.OfficerDesig
	if desig == "" {
		desig = "Ward Officer"
	}
	f.CellFormat(68, 4, desig, "", 0, "C", false, 0, "")
}

func drawFooter(f *gofpdf.Fpdf, req *models.PDFRequest) {
	const footerH = 8.0
	const footerY = pgH - 11

	setFill(f, cNavy)
	f.Rect(6.5, footerY, pgW-13, footerH, "F")

	setText(f, cGold)
	f.SetFont("NPB", "", 7)
	f.SetXY(mL, footerY+1.5)
	f.CellFormat(body*0.6, 4, "PRATIBIMBA — राष्ट्रिय कागज अखण्डता प्रणाली", "", 0, "L", false, 0, "")

	setText(f, cWhite)
	f.SetFont("LT", "", 5.5)
	f.SetXY(mL, footerY+5.5)
	f.CellFormat(body*0.7, 3, "Nepal Electronic Transactions Act 2063 — Digitally Authenticated", "", 0, "L", false, 0, "")

	setFill(f, cGold)
	f.Circle(pgW-22, footerY+4, 4, "F")
	setText(f, cNavy)
	f.SetFont("LTB", "", 4)
	f.SetXY(pgW-30, footerY+2.5)
	f.CellFormat(16, 3, "PRATIBIMBA", "", 1, "C", false, 0, "")
	f.SetXY(pgW-30, footerY+5)
	f.CellFormat(16, 3, "VERIFIED", "", 0, "C", false, 0, "")
}

func setFill(f *gofpdf.Fpdf, c RGB) {
	f.SetFillColor(c.R, c.G, c.B)
}

func setDraw(f *gofpdf.Fpdf, c RGB) {
	f.SetDrawColor(c.R, c.G, c.B)
}

func setText(f *gofpdf.Fpdf, c RGB) {
	f.SetTextColor(c.R, c.G, c.B)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

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
	case "BUDGET_ALLOCATION":
		return "बजेट विनियोजन पत्र"
	default:
		return "सरकारी कागज"
	}
}

var NepaliMonths = map[int]string{
	1:  "बैशाख",
	2:  "जेठ",
	3:  "असार",
	4:  "श्रावण",
	5:  "भाद्र",
	6:  "असोज",
	7:  "कार्तिक",
	8:  "मंसिर",
	9:  "पुस",
	10: "माघ",
	11: "फाल्गुन",
	12: "चैत्र",
}

func FormatNepaliDate(t time.Time) string {
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

func FormatValidUntil(issuedAt time.Time) string {
	if issuedAt.IsZero() {
		issuedAt = time.Now()
	}
	validUntil := issuedAt.AddDate(0, 0, 30)
	return FormatNepaliDate(validUntil)
}
