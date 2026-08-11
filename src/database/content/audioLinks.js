// Optional links from an audio file to specific hadiths.
// Used when you want hadith_audio join rows in the database.
//
// filename       — must match an entry in audios.js
// chapter_number — chapter that contains the hadith
// hadith_number  — hadith id within that chapter (string)

const audioLinks = [
  { filename: '001.mp3', chapter_number: 1, hadith_number: '1' },
  { filename: '002.mp3', chapter_number: 1, hadith_number: '2' },
  { filename: '003.mp3', chapter_number: 1, hadith_number: '3' },
  { filename: '004.mp3', chapter_number: 1, hadith_number: '4' },
];

export default audioLinks;
