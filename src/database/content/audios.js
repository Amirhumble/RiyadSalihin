// Lesson list. Add a new lesson by appending an object like the ones below.
// Also add the matching require() in services/audioAssets.js.
//
// filename           — must match a file in assets/audio/
// title              — shown in the list and reader header
// hadith_number_from — first global hadith (0 = introduction)
// hadith_number_to   — last global hadith (0 = introduction)
// ordering           — list sort order
// pdf_page           — PDF page to open in the reader

const audios = [
  {
    filename: '001.mp3',
    title: 'ሙቀዲማ',
    hadith_number_from: 0,
    hadith_number_to: 0,
    ordering: 1,
    pdf_page: 7,
  },
  {
    filename: '002.mp3',
    title: 'ክፍል 002',
    hadith_number_from: 1,
    hadith_number_to: 5,
    ordering: 2,
    pdf_page: 11,
  },
  {
    filename: '003.mp3',
    title: 'ክፍል 003',
    hadith_number_from: 6,
    hadith_number_to: 10,
    ordering: 3,
    pdf_page: 13,
  },

   {
    filename: '004.mp3',
    title: 'ክፍል 004',
    hadith_number_from: 11,
    hadith_number_to: 12,
    ordering: 4,
    pdf_page: 13,
  },

   {
    filename: '005.mp3',
    title: 'ክፍል 005',
    hadith_number_from: 13,
    hadith_number_to: 19,
    ordering: 5,
    pdf_page: 18,
  },

   {
    filename: '006.mp3',
    title: 'ክፍል 006',
    hadith_number_from: 20,
    hadith_number_to: 20,
    ordering: 6,
    pdf_page: 20,
  },

   {
    filename: '007.mp3',
    title: 'ክፍል 007',
    hadith_number_from: 21,
    hadith_number_to: 21,
    ordering: 7,
    pdf_page: 21,
  },

   {
    filename: '008.mp3',
    title: 'ክፍል 008',
    hadith_number_from: 21,
    hadith_number_to: 21,
    ordering: 8,
    pdf_page: 24,
  },

   {
    filename: '009.mp3',
    title: 'ክፍል 009',
    hadith_number_from: 22,
    hadith_number_to: 24,
    ordering: 9,
    pdf_page: 29,
  },

   {
    filename: '010.mp3',
    title: 'ክፍል 010',
    hadith_number_from: 25,
    hadith_number_to: 27,
    ordering: 10,
    pdf_page: 30,
  },

   {
    filename: '011.mp3',
    title: 'ክፍል 011',
    hadith_number_from: 28,
    hadith_number_to: 30,
    ordering: 11,
    pdf_page: 31,
  },

   {
    filename: '012.mp3',
    title: 'ክፍል 012',
    hadith_number_from: 31,
    hadith_number_to: 37,
    ordering: 12,
    pdf_page: 35,
  },

   {
    filename: '013.mp3',
    title: 'ክፍል 013',
    hadith_number_from: 38,
    hadith_number_to: 44,
    ordering: 13,
    pdf_page: 36,
  },

   {
    filename: '014.mp3',
    title: 'ክፍል 014',
    hadith_number_from: 45,
    hadith_number_to: 53,
    ordering: 14,
    pdf_page: 40,
  },

   {
    filename: '015.mp3',
    title: 'ክፍል 015',
    hadith_number_from: 54,
    hadith_number_to: 59,
    ordering: 15,
    pdf_page: 43,
  },

   {
    filename: '016.mp3',
    title: 'ክፍል 016',
    hadith_number_from: 60,
    hadith_number_to: 61,
    ordering: 16,
    pdf_page: 45,
  },

   {
    filename: '017.mp3',
    title: 'ክፍል 017',
    hadith_number_from: 62,
    hadith_number_to: 63,
    ordering: 17,
    pdf_page: 46,
  },

   {
    filename: '018.mp3',
    title: 'ክፍል 018',
    hadith_number_from: 63,
    hadith_number_to: 68,
    ordering: 18,
    pdf_page: 47,
  },

   {
    filename: '019.mp3',
    title: 'ክፍል 019',
    hadith_number_from: 69,
    hadith_number_to: 73,
    ordering: 19,
    pdf_page: 51,
  },

   {
    filename: '020.mp3',
    title: 'ክፍል 020',
    hadith_number_from: 74,
    hadith_number_to: 74,
    ordering: 20,
    pdf_page: 53,
  },

  {
    filename: '021.mp3',
    title: 'ክፍል 021',
    hadith_number_from: 75,
    hadith_number_to: 80,
    ordering: 21,
    pdf_page: 54,
  },

  {
    filename: '022.mp3',
    title: 'ክፍል 022',
    hadith_number_from: 81,
    hadith_number_to: 84,
    ordering: 22,
    pdf_page: 56,
  },

  {
    filename: '023.mp3',
    title: 'ክፍል 023',
    hadith_number_from: 85,
    hadith_number_to: 86,
    ordering: 23,
    pdf_page: 55,
  },

  {
    filename: '024.mp3',
    title: 'ክፍል 024',
    hadith_number_from: 87,
    hadith_number_to: 91,
    ordering: 24,
    pdf_page: 58,
  },

  {
    filename: '025.mp3',
    title: 'ክፍል 025',
    hadith_number_from: 92,
    hadith_number_to: 94,
    ordering: 25,
    pdf_page: 61,
  },

  {
    filename: '026.mp3',
    title: 'ክፍል 026',
    hadith_number_from: 95,
    hadith_number_to: 100,
    ordering: 26,
    pdf_page: 63,
  },

  {
    filename: '027.mp3',
    title: 'ክፍል 027',
    hadith_number_from: 101,
    hadith_number_to: 107,
    ordering: 27,
    pdf_page: 65,
  },

  {
    filename: '028.mp3',
    title: 'ክፍል 028',
    hadith_number_from: 108,
    hadith_number_to: 111,
    ordering: 28,
    pdf_page: 67,
  },

  {
    filename: '029.mp3',
    title: 'ክፍል 029',
    hadith_number_from: 112,
    hadith_number_to: 116,
    ordering: 29,
    pdf_page: 80,
  },

  {
    filename: '030.mp3',
    title: 'ክፍል 030',
    hadith_number_from: 117,
    hadith_number_to: 122,
    ordering: 30,
    pdf_page: 73,
  },

  {
    filename: '031.mp3',
    title: 'ክፍል 031',
    hadith_number_from: 123,
    hadith_number_to: 132,
    ordering: 31,
    pdf_page: 85,
  },

  {
    filename: '032.mp3',
    title: 'ክፍል 032',
    hadith_number_from: 133,
    hadith_number_to: 141,
    ordering: 32,
    pdf_page: 78,
  },

  {
    filename: '033.mp3',
    title: 'ክፍል 033',
    hadith_number_from: 142,
    hadith_number_to: 145,
    ordering: 33,
    pdf_page: 81,
  },

  {
    filename: '034.mp3',
    title: 'ክፍል 034',
    hadith_number_from: 146,
    hadith_number_to: 150,
    ordering: 34,
    pdf_page: 83,
  },

  {
    filename: '035.mp3',
    title: 'ክፍል 035',
    hadith_number_from: 151,
    hadith_number_to: 152,
    ordering: 35,
    pdf_page: 86,
  },

  {
    filename: '036.mp3',
    title: 'ክፍል 036',
    hadith_number_from: 153,
    hadith_number_to: 157,
    ordering: 36,
    pdf_page: 88,
  },

  {
    filename: '037.mp3',
    title: 'ክፍል 037',
    hadith_number_from: 158,
    hadith_number_to: 164,
    ordering: 37,
    pdf_page: 90,
  },

  {
    filename: '038.mp3',
    title: 'ክፍል 038',
    hadith_number_from: 165,
    hadith_number_to: 168,
    ordering: 38,
    pdf_page: 92,
  },

  {
    filename: '039.mp3',
    title: 'ክፍል 039',
    hadith_number_from: 169,
    hadith_number_to: 172,
    ordering: 39,
    pdf_page: 96,
  },

  {
    filename: '040.mp3',
    title: 'ክፍል 040',
    hadith_number_from: 173,
    hadith_number_to: 180,
    ordering: 40,
    pdf_page: 99,
  },
];

export default audios;
