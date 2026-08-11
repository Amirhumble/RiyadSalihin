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
    hadith_number_to: 15,
    ordering: 4,
    pdf_page: 13,
  },
];

export default audios;
