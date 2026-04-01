package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const sparrowSMSURL = "https://api.sparrowsms.com/v2/sms/"

// SMSDocumentReady sends an SMS when a request is approved and a DTID is generated.
func SMSDocumentReady(phone, citizenName, dtid string) {
	message := fmt.Sprintf("Namaste %s, your document is ready. DTID: %s. Verify/download from PRATIBIMBA.", citizenName, dtid)
	sendSMS(phone, message)
}

// SMSRequestRejected sends an SMS when a request is rejected.
func SMSRequestRejected(phone, citizenName, rejectionReason string) {
	message := fmt.Sprintf("Namaste %s, your request was rejected. Reason: %s. Please correct and resubmit.", citizenName, rejectionReason)
	sendSMS(phone, message)
}

func sendSMS(phone, message string) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return
	}

	token := strings.TrimSpace(os.Getenv("SPARROW_SMS_TOKEN"))
	if token == "" || token == "your_sparrow_sms_token_here" {
		log.Printf("SMS skipped: SPARROW_SMS_TOKEN is not configured")
		return
	}

	from := strings.TrimSpace(os.Getenv("SPARROW_SMS_FROM"))
	if from == "" {
		from = "PRATIBIMBA"
	}

	form := url.Values{}
	form.Set("token", token)
	form.Set("from", from)
	form.Set("to", phone)
	form.Set("text", message)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.PostForm(sparrowSMSURL, form)
	if err != nil {
		log.Printf("SMS send failed for %s: %v", phone, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		log.Printf("SMS provider non-2xx for %s: status=%d body=%s", phone, resp.StatusCode, strings.TrimSpace(string(body)))
	}
}
