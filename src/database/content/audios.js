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
];

export default audios;
