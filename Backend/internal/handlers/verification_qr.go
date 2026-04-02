package handlers

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/skip2/go-qrcode"
)

func verificationURLForDTID(dtid string) string {
	dtid = strings.TrimSpace(dtid)
	if dtid == "" {
		return ""
	}
	return fmt.Sprintf("https://verify.pratibimba.gov.np/%s", dtid)
}

func verificationQRCodeDataURL(verifyURL string) (string, error) {
	verifyURL = strings.TrimSpace(verifyURL)
	if verifyURL == "" {
		return "", nil
	}

	png, err := qrcode.Encode(verifyURL, qrcode.High, 256)
	if err != nil {
		return "", err
	}

	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}