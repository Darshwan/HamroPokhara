const NEPALI_MONTH_MAP: Record<string, string> = {
  Baisakh: 'Baisakh',
  Jestha: 'Jestha',
  Ashadh: 'Ashadh',
  Shrawan: 'Shrawan',
  Bhadra: 'Bhadra',
  Ashwin: 'Ashwin',
  Kartik: 'Kartik',
  Mangsir: 'Mangsir',
  Poush: 'Poush',
  Magh: 'Magh',
  Falgun: 'Falgun',
  Chaitra: 'Chaitra',
  बैशाख: 'Baisakh',
  जेठ: 'Jestha',
  असार: 'Ashadh',
  श्रावण: 'Shrawan',
  भदौ: 'Bhadra',
  आश्विन: 'Ashwin',
  कार्तिक: 'Kartik',
  मङ्सिर: 'Mangsir',
  पौष: 'Poush',
  माघ: 'Magh',
  फाल्गुन: 'Falgun',
  चैत्र: 'Chaitra',
};

const toEnglishDigits = (value: string) =>
  value.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)));

export const formatNepaliCalendarDate = (
  inputDate: Date | string | number,
  options?: { includeWeekday?: boolean }
) => {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('ne-NP-u-ca-nepali', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(options?.includeWeekday ? { weekday: 'long' } : {}),
  }).formatToParts(date);

  const monthRaw = parts.find((part) => part.type === 'month')?.value || '';
  const dayRaw = parts.find((part) => part.type === 'day')?.value || '';
  const yearRaw = parts.find((part) => part.type === 'year')?.value || '';
  const weekdayRaw = parts.find((part) => part.type === 'weekday')?.value || '';

  const month = NEPALI_MONTH_MAP[monthRaw] || monthRaw;
  const day = toEnglishDigits(dayRaw);
  const year = toEnglishDigits(yearRaw);
  const weekday = weekdayRaw ? `, ${weekdayRaw}` : '';

  return `${month}, ${day}, ${year}${weekday}`.replace(/\s+,/g, ',');
};

export const formatNepaliCalendarShortDate = (inputDate: Date | string | number) => {
  const full = formatNepaliCalendarDate(inputDate);
  const parts = full.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : full;
};
