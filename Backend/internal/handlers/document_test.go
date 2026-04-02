package handlers

import "testing"

func TestNormalizeSifarisDocumentType(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: "SIFARIS"},
		{name: "canonical", in: "SIFARIS", want: "SIFARIS"},
		{name: "lowercase", in: "sifaris", want: "SIFARIS"},
		{name: "legacy citizenship letter", in: "CITIZENSHIP_LETTER", want: "SIFARIS"},
		{name: "legacy recommendation", in: "recommendation_letter", want: "SIFARIS"},
		{name: "other type passthrough", in: "BIRTH_CERTIFICATE", want: "BIRTH_CERTIFICATE"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeSifarisDocumentType(tt.in); got != tt.want {
				t.Fatalf("normalizeSifarisDocumentType(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
