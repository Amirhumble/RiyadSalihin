// Lesson list. Add a new lesson by appending an object like the ones below.
// Upload the matching MP3 to the R2 bucket (object key = audio/{filename}).
//
// filename           — must match the R2 object, e.g. audio/001.mp3
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
  {
    filename: '041.mp3',
    title: 'ክፍል 041',
    hadith_number_from: 181,
    hadith_number_to: 184,
    ordering: 41,
    pdf_page: 102,
  },
  {
    filename: '042.mp3',
    title: 'ክፍል 042',
    hadith_number_from: 185,
    hadith_number_to: 189,
    ordering: 42,
    pdf_page: 103,
  },
  {
    filename: '043.mp3',
    title: 'ክፍል 043',
    hadith_number_from: 190,
    hadith_number_to: 197,
    ordering: 43,
    pdf_page: 105,
  },
  {
    filename: '044.mp3',
    title: 'ክፍል 044',
    hadith_number_from: 198,
    hadith_number_to: 200,
    ordering: 44,
    pdf_page: 108,
  },
  {
    filename: '045.mp3',
    title: 'ክፍል 045',
    hadith_number_from: 201,
    hadith_number_to: 202,
    ordering: 45,
    pdf_page: 110,
  },
  {
    filename: '046.mp3',
    title: 'ክፍል 046',
    hadith_number_from: 203,
    hadith_number_to: 207,
    ordering: 46,
    pdf_page: 114,
  },
  {
    filename: '047.mp3',
    title: 'ክፍል 047',
    hadith_number_from: 208,
    hadith_number_to: 215,
    ordering: 47,
    pdf_page: 115,
  },
  {
    filename: '048.mp3',
    title: 'ክፍል 048',
    hadith_number_from: 216,
    hadith_number_to: 221,
    ordering: 48,
    pdf_page: 118,
  },
  {
    filename: '049.mp3',
    title: 'ክፍል 049',
    hadith_number_from: 222,
    hadith_number_to: 232,
    ordering: 49,
    pdf_page: 120,
  },
  {
    filename: '050.mp3',
    title: 'ክፍል 050',
    hadith_number_from: 233,
    hadith_number_to: 239,
    ordering: 50,
    pdf_page: 122,
  },

  {
    filename: '051.mp3',
    title: 'ክፍል 051',
    hadith_number_from: 240,
    hadith_number_to: 245,
    ordering: 51,
    pdf_page: 125,
  },

  {
    filename: '052.mp3',
    title: 'ክፍል 052',
    hadith_number_from: 246,
    hadith_number_to: 251,
    ordering: 52,
    pdf_page: 126,
  },

  {
    filename: '053.mp3',
    title: 'ክፍል 053',
    hadith_number_from: 252,
    hadith_number_to: 259,
    ordering: 53,
    pdf_page: 129,
  },

  {
    filename: '054.mp3',
    title: 'ክፍል 054',
    hadith_number_from: 260,
    hadith_number_to: 272,
    ordering: 54,
    pdf_page: 134,
  },

  {
    filename: '055.mp3',
    title: 'ክፍል 055',
    hadith_number_from: 273,
    hadith_number_to: 278,
    ordering: 55,
    pdf_page: 135,
  },

  {
    filename: '056.mp3',
    title: 'ክፍል 056',
    hadith_number_from: 279,
    hadith_number_to: 288,
    ordering: 56,
    pdf_page: 140,
  },

  {
    filename: '057.mp3',
    title: 'ክፍል 057',
    hadith_number_from: 289,
    hadith_number_to: 297,
    ordering: 57,
    pdf_page: 143,
  },

  {
    filename: '058.mp3',
    title: 'ክፍል 058',
    hadith_number_from: 298,
    hadith_number_to: 305,
    ordering: 58,
    pdf_page: 146,
  },

  {
    filename: '059.mp3',
    title: 'ክፍል 059',
    hadith_number_from: 306,
    hadith_number_to: 314,
    ordering: 59,
    pdf_page: 149,
  },

  {
    filename: '060.mp3',
    title: 'ክፍል 060',
    hadith_number_from: 315,
    hadith_number_to: 322,
    ordering: 60,
    pdf_page: 151,
  },

  {
    filename: '061.mp3',
    title: 'ክፍል 061',
    hadith_number_from: 323,
    hadith_number_to: 330,
    ordering: 61,
    pdf_page: 155,
  },

  {
    filename: '062.mp3',
    title: 'ክፍል 062',
    hadith_number_from: 331,
    hadith_number_to: 340,
    ordering: 62,
    pdf_page: 157,
  },

  {
    filename: '063.mp3',
    title: 'ክፍል 063',
    hadith_number_from: 341,
    hadith_number_to: 345,
    ordering: 63,
    pdf_page: 161,
  },

  {
    filename: '064.mp3',
    title: 'ክፍል 064',
    hadith_number_from: 346,
    hadith_number_to: 351,
    ordering: 64,
    pdf_page: 164,
  },

  {
    filename: '065.mp3',
    title: 'ክፍል 065',
    hadith_number_from: 352,
    hadith_number_to: 359,
    ordering: 65,
    pdf_page: 167,
  },

  {
    filename: '066.mp3',
    title: 'ክፍል 066',
    hadith_number_from: 360,
    hadith_number_to: 370,
    ordering: 66,
    pdf_page: 169,
  },

  {
    filename: '067.mp3',
    title: 'ክፍል 067',
    hadith_number_from: 371,
    hadith_number_to: 374,
    ordering: 67,
    pdf_page: 172,
  },

  {
    filename: '068.mp3',
    title: 'ክፍል 068',
    hadith_number_from: 375,
    hadith_number_to: 382,
    ordering: 68,
    pdf_page: 175,
  },

  {
    filename: '069.mp3',
    title: 'ክፍል 069',
    hadith_number_from: 383,
    hadith_number_to: 388,
    ordering: 69,
    pdf_page: 177,
  },

  {
    filename: '070.mp3',
    title: 'ክፍል 070',
    hadith_number_from: 389,
    hadith_number_to: 395,
    ordering: 70,
    pdf_page: 180,
  },

  {
    filename: '071.mp3',
    title: 'ክፍል 071',
    hadith_number_from: 396,
    hadith_number_to: 400,
    ordering: 71,
    pdf_page: 184,
  },

  {
    filename: '072.mp3',
    title: 'ክፍል 072',
    hadith_number_from: 401,
    hadith_number_to: 411,
    ordering: 72,
    pdf_page: 186,
  },

  {
    filename: '073.mp3',
    title: 'ክፍል 073',
    hadith_number_from: 412,
    hadith_number_to: 416,
    ordering: 73,
    pdf_page: 190,
  },

  {
    filename: '074.mp3',
    title: 'ክፍል 074',
    hadith_number_from: 417,
    hadith_number_to: 423,
    ordering: 74,
    pdf_page: 192,
  },

  {
    filename: '075.mp3',
    title: 'ክፍል 075',
    hadith_number_from: 424,
    hadith_number_to: 432,
    ordering: 75,
    pdf_page: 196,
  },

  {
    filename: '076.mp3',
    title: 'ክፍል 076',
    hadith_number_from: 433,
    hadith_number_to: 439,
    ordering: 76,
    pdf_page: 199,
  },

  {
    filename: '077.mp3',
    title: 'ክፍል 077',
    hadith_number_from: 440,
    hadith_number_to: 445,
    ordering: 77,
    pdf_page: 204,
  },

  {
    filename: '078.mp3',
    title: 'ክፍል 078',
    hadith_number_from: 446,
    hadith_number_to: 456,
    ordering: 78,
    pdf_page: 206,
  },

  {
    filename: '079.mp3',
    title: 'ክፍል 079',
    hadith_number_from: 457,
    hadith_number_to: 463,
    ordering: 79,
    pdf_page: 210,
  },

  {
    filename: '080.mp3',
    title: 'ክፍል 080',
    hadith_number_from: 464,
    hadith_number_to: 474,
    ordering: 80,
    pdf_page: 212,
  },

  {
    filename: '081.mp3',
    title: 'ክፍል 081',
    hadith_number_from: 475,
    hadith_number_to: 485,
    ordering: 81,
    pdf_page: 215,
  },

  {
    filename: '082.mp3',
    title: 'ክፍል 082',
    hadith_number_from: 486,
    hadith_number_to: 489,
    ordering: 82,
    pdf_page: 218,
  },

  {
    filename: '083.mp3',
    title: 'ክፍል 083',
    hadith_number_from: 490,
    hadith_number_to: 498,
    ordering: 83,
    pdf_page: 219,
  },

  {
    filename: '084.mp3',
    title: 'ክፍል 084',
    hadith_number_from: 499,
    hadith_number_to: 508,
    ordering: 84,
    pdf_page: 224,
  },

  {
    filename: '085.mp3',
    title: 'ክፍል 085',
    hadith_number_from: 509,
    hadith_number_to: 518,
    ordering: 85,
    pdf_page: 227,
  },

  {
    filename: '086.mp3',
    title: 'ክፍል 086',
    hadith_number_from: 519,
    hadith_number_to: 521,
    ordering: 86,
    pdf_page: 230,
  },

  {
    filename: '087.mp3',
    title: 'ክፍል 087',
    hadith_number_from: 522,
    hadith_number_to: 532,
    ordering: 87,
    pdf_page: 235,
  },

  {
    filename: '088.mp3',
    title: 'ክፍል 088',
    hadith_number_from: 533,
    hadith_number_to: 543,
    ordering: 88,
    pdf_page: 238,
  },

  {
    filename: '089.mp3',
    title: 'ክፍል 089',
    hadith_number_from: 544,
    hadith_number_to: 556,
    ordering: 89,
    pdf_page: 242,
  },

  {
    filename: '090.mp3',
    title: 'ክፍል 090',
    hadith_number_from: 557,
    hadith_number_to: 562,
    ordering: 90,
    pdf_page: 244,
  },

  {
    filename: '091.mp3',
    title: 'ክፍል 091',
    hadith_number_from: 563,
    hadith_number_to: 568,
    ordering: 91,
    pdf_page: 248,
  },

  {
    filename: '092.mp3',
    title: 'ክፍል 092',
    hadith_number_from: 569,
    hadith_number_to: 573,
    ordering: 92,
    pdf_page: 250,
  },

  {
    filename: '093.mp3',
    title: 'ክፍል 093',
    hadith_number_from: 574,
    hadith_number_to: 575,
    ordering: 93,
    pdf_page: 253,
  },

  {
    filename: '094.mp3',
    title: 'ክፍል 094',
    hadith_number_from: 576,
    hadith_number_to: 584,
    ordering: 94,
    pdf_page: 254,
  },

  {
    filename: '095.mp3',
    title: 'ክፍል 095',
    hadith_number_from: 585,
    hadith_number_to: 592,
    ordering: 95,
    pdf_page: 256,
  },

  {
    filename: '096.mp3',
    title: 'ክፍል 096',
    hadith_number_from: 593,
    hadith_number_to: 601,
    ordering: 96,
    pdf_page: 259,
  },

  {
    filename: '097.mp3',
    title: 'ክፍል 097',
    hadith_number_from: 602,
    hadith_number_to: 611,
    ordering: 97,
    pdf_page: 263,
  },

  {
    filename: '098.mp3',
    title: 'ክፍል 098',
    hadith_number_from: 612,
    hadith_number_to: 620,
    ordering: 98,
    pdf_page: 265,
  },

  {
    filename: '099.mp3',
    title: 'ክፍል 099',
    hadith_number_from: 621,
    hadith_number_to: 631,
    ordering: 99,
    pdf_page: 267,
  },

  {
    filename: '100.mp3',
    title: 'ክፍል 100',
    hadith_number_from: 632,
    hadith_number_to: 642,
    ordering: 100,
    pdf_page: 270,
  },

  {
    filename: '101.mp3',
    title: 'ክፍል 101',
    hadith_number_from: 643,
    hadith_number_to: 647,
    ordering: 101,
    pdf_page: 272,
  },

  {
    filename: '102.mp3',
    title: 'ክፍል 102',
    hadith_number_from: 648,
    hadith_number_to: 652,
    ordering: 102,
    pdf_page: 273,
  },

  {
    filename: '103.mp3',
    title: 'ክፍል 103',
    hadith_number_from: 653,
    hadith_number_to: 658,
    ordering: 103,
    pdf_page: 276,
  },

  {
    filename: '104.mp3',
    title: 'ክፍል 104',
    hadith_number_from: 659,
    hadith_number_to: 667,
    ordering: 104,
    pdf_page: 277,
  },

  {
    filename: '105.mp3',
    title: 'ክፍል 105',
    hadith_number_from: 668,
    hadith_number_to: 677,
    ordering: 105,
    pdf_page: 279,
  },

  {
    filename: '106.mp3',
    title: 'ክፍል 106',
    hadith_number_from: 678,
    hadith_number_to: 684,
    ordering: 106,
    pdf_page: 283,
  },

  {
    filename: '108.mp3',
    title: 'ክፍል 108',
    hadith_number_from: 692,
    hadith_number_to: 698,
    ordering: 108,
    pdf_page: 289,
  },

  {
    filename: '109.mp3',
    title: 'ክፍል 109',
    hadith_number_from: 699,
    hadith_number_to: 703,
    ordering: 109,
    pdf_page: 290,
  },

  {
    filename: '110.mp3',
    title: 'ክፍል 110',
    hadith_number_from: 704,
    hadith_number_to: 708,
    ordering: 110,
    pdf_page: 293,
  },

  {
    filename: '111.mp3',
    title: 'ክፍል 111',
    hadith_number_from: 709,
    hadith_number_to: 711,
    ordering: 111,
    pdf_page: 295,
  },

  {
    filename: '112.mp3',
    title: 'ክፍል 112',
    hadith_number_from: 712,
    hadith_number_to: 718,
    ordering: 112,
    pdf_page: 299,
  },

  {
    filename: '113.mp3',
    title: 'ክፍል 113',
    hadith_number_from: 719,
    hadith_number_to: 727,
    ordering: 113,
    pdf_page: 301,
  },

  {
    filename: '114.mp3',
    title: 'ክፍል 114',
    hadith_number_from: 728,
    hadith_number_to: 739,
    ordering: 114,
    pdf_page: 305,
  },

  {
    filename: '115.mp3',
    title: 'ክፍል 115',
    hadith_number_from: 740,
    hadith_number_to: 747,
    ordering: 115,
    pdf_page: 308,
  },

  {
    filename: '116.mp3',
    title: 'ክፍል 116',
    hadith_number_from: 748,
    hadith_number_to: 761,
    ordering: 116,
    pdf_page: 310,
  },

  {
    filename: '117.mp3',
    title: 'ክፍል 117',
    hadith_number_from: 762,
    hadith_number_to: 773,
    ordering: 117,
    pdf_page: 313,
  },

  {
    filename: '118.mp3',
    title: 'ክፍል 118',
    hadith_number_from: 774,
    hadith_number_to: 778,
    ordering: 118,
    pdf_page: 316,
  },

  {
    filename: '119.mp3',
    title: 'ክፍል 119',
    hadith_number_from: 779,
    hadith_number_to: 788,
    ordering: 119,
    pdf_page: 318,
  },

  {
    filename: '120.mp3',
    title: 'ክፍል 120',
    hadith_number_from: 789,
    hadith_number_to: 796,
    ordering: 120,
    pdf_page: 321,
  },

  {
    filename: '121.mp3',
    title: 'ክፍል 121',
    hadith_number_from: 797,
    hadith_number_to: 801,
    ordering: 121,
    pdf_page: 323,
  },

  {
    filename: '122.mp3',
    title: 'ክፍል 122',
    hadith_number_from: 802,
    hadith_number_to: 813,
    ordering: 122,
    pdf_page: 326,
  },

  {
    filename: '123.mp3',
    title: 'ክፍል 123',
    hadith_number_from: 814,
    hadith_number_to: 824,
    ordering: 123,
    pdf_page: 329,
  },

   {
    filename: '124.mp3',
    title: 'ክፍል 124',
    hadith_number_from: 825,
    hadith_number_to: 837,
    ordering: 124,
    pdf_page: 331,
  },

   {
    filename: '125.mp3',
    title: 'ክፍል 125',
    hadith_number_from: 838,
    hadith_number_to: 844,
    ordering: 125,
    pdf_page: 334,
  },

   {
    filename: '126.mp3',
    title: 'ክፍል 126',
    hadith_number_from: 845,
    hadith_number_to: 850,
    ordering: 126,
    pdf_page: 337,
  },

   {
    filename: '127.mp3',
    title: 'ክፍል 127',
    hadith_number_from: 851,
    hadith_number_to: 858,
    ordering: 127,
    pdf_page: 339,
  },

   {
    filename: '128.mp3',
    title: 'ክፍል 128',
    hadith_number_from: 859,
    hadith_number_to: 869,
    ordering: 128,
    pdf_page: 341,
  },

   {
    filename: '129.mp3',
    title: 'ክፍል 129',
    hadith_number_from: 870,
    hadith_number_to: 884,
    ordering: 129,
    pdf_page: 344,
  },

   {
    filename: '130.mp3',
    title: 'ክፍል 130',
    hadith_number_from: 885,
    hadith_number_to: 898,
    ordering: 130,
    pdf_page: 347,
  },

   {
    filename: '131.mp3',
    title: 'ክፍል 131',
    hadith_number_from: 899,
    hadith_number_to: 912,
    ordering: 131,
    pdf_page: 350,
  },

   {
    filename: '132.mp3',
    title: 'ክፍል 132',
    hadith_number_from: 913,
    hadith_number_to: 924,
    ordering: 132,
    pdf_page: 354,
  },

   {
    filename: '133.mp3',
    title: 'ክፍል 133',
    hadith_number_from: 925,
    hadith_number_to: 934,
    ordering: 133,
    pdf_page: 357,
  },

   {
    filename: '134.mp3',
    title: 'ክፍል 134',
    hadith_number_from: 935,
    hadith_number_to: 942,
    ordering: 134,
    pdf_page: 360,
  },

   {
    filename: '135.mp3',
    title: 'ክፍል 135',
    hadith_number_from: 943,
    hadith_number_to: 951,
    ordering: 135,
    pdf_page: 363,
  },

   {
    filename: '136.mp3',
    title: 'ክፍል 136',
    hadith_number_from: 952,
    hadith_number_to: 961,
    ordering: 136,
    pdf_page: 366,
  },

   {
    filename: '137.mp3',
    title: 'ክፍል 137',
    hadith_number_from: 962,
    hadith_number_to: 968,
    ordering: 137,
    pdf_page: 370,
  },

   {
    filename: '138.mp3',
    title: 'ክፍል 138',
    hadith_number_from: 969,
    hadith_number_to: 979,
    ordering: 138,
    pdf_page: 373,
  },

   {
    filename: '139.mp3',
    title: 'ክፍል 139',
    hadith_number_from: 980,
    hadith_number_to: 990,
    ordering: 139,
    pdf_page: 377,
  },

   {
    filename: '140.mp3',
    title: 'ክፍል 140',
    hadith_number_from: 991,
    hadith_number_to: 1001,
    ordering: 140,
    pdf_page: 381,
  },

   {
    filename: '141.mp3',
    title: 'ክፍል 141',
    hadith_number_from: 1002,
    hadith_number_to: 1014,
    ordering: 141,
    pdf_page: 383,
  },

   {
    filename: '142.mp3',
    title: 'ክፍል 142',
    hadith_number_from: 1015,
    hadith_number_to: 1023,
    ordering: 142,
    pdf_page: 386,
  },

   {
    filename: '143.mp3',
    title: 'ክፍል 143',
    hadith_number_from: 1024,
    hadith_number_to: 1032,
    ordering: 143,
    pdf_page: 389,
  },

   {
    filename: '144.mp3',
    title: 'ክፍል 144',
    hadith_number_from: 1033,
    hadith_number_to: 1041,
    ordering: 144,
    pdf_page: 392,
  },

   {
    filename: '145.mp3',
    title: 'ክፍል 145',
    hadith_number_from: 1042,
    hadith_number_to: 1052,
    ordering: 145,
    pdf_page: 394,
  },

   {
    filename: '146.mp3',
    title: 'ክፍል 146',
    hadith_number_from: 1053,
    hadith_number_to: 1063,
    ordering: 146,
    pdf_page: 397,
  },

   {
    filename: '147.mp3',
    title: 'ክፍል 147',
    hadith_number_from: 1064,
    hadith_number_to: 1073,
    ordering: 147,
    pdf_page: 399,
  },

   {
    filename: '148.mp3',
    title: 'ክፍል 148',
    hadith_number_from: 1074,
    hadith_number_to: 1081,
    ordering: 148,
    pdf_page: 402,
  },

   {
    filename: '149.mp3',
    title: 'ክፍል 149',
    hadith_number_from: 1082,
    hadith_number_to: 1096,
    ordering: 149,
    pdf_page: 404,
  },

   {
    filename: '150.mp3',
    title: 'ክፍል 150',
    hadith_number_from: 1097,
    hadith_number_to: 1109,
    ordering: 150,
    pdf_page: 407,
  },

   {
    filename: '151.mp3',
    title: 'ክፍል 151',
    hadith_number_from: 1110,
    hadith_number_to: 1127,
    ordering: 151,
    pdf_page: 410,
  },

   {
    filename: '152.mp3',
    title: 'ክፍል 152',
    hadith_number_from: 1128,
    hadith_number_to: 1146,
    ordering: 152,
    pdf_page: 413,
  },

   {
    filename: '153.mp3',
    title: 'ክፍል 153',
    hadith_number_from: 1147,
    hadith_number_to: 1159,
    ordering: 153,
    pdf_page: 418,
  },

   {
    filename: '154.mp3',
    title: 'ክፍል 154',
    hadith_number_from: 1160,
    hadith_number_to: 1182,
    ordering: 154,
    pdf_page: 422,
  },

   {
    filename: '155.mp3',
    title: 'ክፍል 155',
    hadith_number_from: 1183,
    hadith_number_to: 1195,
    ordering: 155,
    pdf_page: 426,
  },

   {
    filename: '156.mp3',
    title: 'ክፍል 156',
    hadith_number_from: 1196,
    hadith_number_to: 1205,
    ordering: 156,
    pdf_page: 428,
  },

   {
    filename: '157.mp3',
    title: 'ክፍል 157',
    hadith_number_from: 1206,
    hadith_number_to: 1214,
    ordering: 157,
    pdf_page: 430,
  },

   {
    filename: '158.mp3',
    title: 'ክፍል 158',
    hadith_number_from: 1215,
    hadith_number_to: 1221,
    ordering: 158,
    pdf_page: 435,
  },

   {
    filename: '159.mp3',
    title: 'ክፍል 159',
    hadith_number_from: 1222,
    hadith_number_to: 1239,
    ordering: 159,
    pdf_page: 437,
  },

   {
    filename: '160.mp3',
    title: 'ክፍል 160',
    hadith_number_from: 1240,
    hadith_number_to: 1267,
    ordering: 160,
    pdf_page: 441,
  },

   {
    filename: '161.mp3',
    title: 'ክፍል 161',
    hadith_number_from: 1268,
    hadith_number_to: 1284,
    ordering: 161,
    pdf_page: 447,
  },

   {
    filename: '162.mp3',
    title: 'ክፍል 162',
    hadith_number_from: 1285,
    hadith_number_to: 1294,
    ordering: 162,
    pdf_page: 452,
  },

   {
    filename: '163.mp3',
    title: 'ክፍል 163',
    hadith_number_from: 1295,
    hadith_number_to: 1305,
    ordering: 163,
    pdf_page: 454,
  },

   {
    filename: '164.mp3',
    title: 'ክፍል 164',
    hadith_number_from: 1306,
    hadith_number_to: 1319,
    ordering: 164,
    pdf_page: 457,
  },

   {
    filename: '165.mp3',
    title: 'ክፍል 165',
    hadith_number_from: 1320,
    hadith_number_to: 1343,
    ordering: 165,
    pdf_page: 462,
  },

   {
    filename: '167.mp3',
    title: 'ክፍል 167',
    hadith_number_from: 1362,
    hadith_number_to: 1375,
    ordering: 167,
    pdf_page: 471,
  },

   {
    filename: '168.mp3',
    title: 'ክፍል 168',
    hadith_number_from: 1376,
    hadith_number_to: 1387,
    ordering: 168,
    pdf_page: 475,
  },

   {
    filename: '169.mp3',
    title: 'ክፍል 169',
    hadith_number_from: 1388,
    hadith_number_to: 1407,
    ordering: 169,
    pdf_page: 477,
  },

   {
    filename: '170.mp3',
    title: 'ክፍል 170',
    hadith_number_from: 1408,
    hadith_number_to: 1421,
    ordering: 170,
    pdf_page: 484,
  },

   {
    filename: '171.mp3',
    title: 'ክፍል 171',
    hadith_number_from: 1421,
    hadith_number_to: 1433,
    ordering: 171,
    pdf_page: 488,
  },

   {
    filename: '172.mp3',
    title: 'ክፍል 172',
    hadith_number_from: 1434,
    hadith_number_to: 1443,
    ordering: 172,
    pdf_page: 491,
  },

   {
    filename: '173.mp3',
    title: 'ክፍል 173',
    hadith_number_from: 1444,
    hadith_number_to: 1449,
    ordering: 173,
    pdf_page: 494,
  },

   {
    filename: '174.mp3',
    title: 'ክፍል 174',
    hadith_number_from: 1450,
    hadith_number_to: 1457,
    ordering: 174,
    pdf_page: 497,
  },

   {
    filename: '175.mp3',
    title: 'ክፍል 175',
    hadith_number_from: 1458,
    hadith_number_to: 1464,
    ordering: 175,
    pdf_page: 500,
  },

   {
    filename: '176.mp3',
    title: 'ክፍል 176',
    hadith_number_from: 1465,
    hadith_number_to: 1476,
    ordering: 176,
    pdf_page: 503,
  },

   {
    filename: '177.mp3',
    title: 'ክፍል 177',
    hadith_number_from: 1477,
    hadith_number_to: 1493,
    ordering: 177,
    pdf_page: 506,
  },

   {
    filename: '178.mp3',
    title: 'ክፍል 178',
    hadith_number_from: 1494,
    hadith_number_to: 1502,
    ordering: 178,
    pdf_page: 510,
  },

   {
    filename: '179.mp3',
    title: 'ክፍል 179',
    hadith_number_from: 1503,
    hadith_number_to: 1504,
    ordering: 179,
    pdf_page: 512,
  },

   {
    filename: '180.mp3',
    title: 'ክፍል 180',
    hadith_number_from: 1505,
    hadith_number_to: 1509,
    ordering: 180,
    pdf_page: 514,
  },

   {
    filename: '181.mp3',
    title: 'ክፍል 181',
    hadith_number_from: 1510,
    hadith_number_to: 1520,
    ordering: 181,
    pdf_page: 519,
  },

   {
    filename: '182.mp3',
    title: 'ክፍል 182',
    hadith_number_from: 1521,
    hadith_number_to: 1530,
    ordering: 182,
    pdf_page: 522,
  },

   {
    filename: '183.mp3',
    title: 'ክፍል 183',
    hadith_number_from: 1531,
    hadith_number_to: 1535,
    ordering: 183,
    pdf_page: 528,
  },

   {
    filename: '184.mp3',
    title: 'ክፍል 184',
    hadith_number_from: 1536,
    hadith_number_to: 1545,
    ordering: 184,
    pdf_page: 530,
  },

   {
    filename: '185.mp3',
    title: 'ክፍል 185',
    hadith_number_from: 1546,
    hadith_number_to: 1546,
    ordering: 185,
    pdf_page: 533,
  },

   {
    filename: '186.mp3',
    title: 'ክፍል 186',
    hadith_number_from: 1547,
    hadith_number_to: 1551,
    ordering: 186,
    pdf_page: 538,
  },

   {
    filename: '187.mp3',
    title: 'ክፍል 187',
    hadith_number_from: 1552,
    hadith_number_to: 1564,
    ordering: 187,
    pdf_page: 540,
  },

   {
    filename: '188.mp3',
    title: 'ክፍል 188',
    hadith_number_from: 1565,
    hadith_number_to: 1577,
    ordering: 188,
    pdf_page: 544,
  },

   {
    filename: '189.mp3',
    title: 'ክፍል 189',
    hadith_number_from: 1578,
    hadith_number_to: 1597,
    ordering: 189,
    pdf_page: 549,
  },

   {
    filename: '190.mp3',
    title: 'ክፍል 190',
    hadith_number_from: 1598,
    hadith_number_to: 1610,
    ordering: 190,
    pdf_page: 555,
  },

   {
    filename: '191.mp3',
    title: 'ክፍል 191',
    hadith_number_from: 1611,
    hadith_number_to: 1620,
    ordering: 191,
    pdf_page: 559,
  },

   {
    filename: '192.mp3',
    title: 'ክፍል 192',
    hadith_number_from: 1621,
    hadith_number_to: 1633,
    ordering: 192,
    pdf_page: 564,
  },

   {
    filename: '193.mp3',
    title: 'ክፍል 193',
    hadith_number_from: 1634,
    hadith_number_to: 1654,
    ordering: 193,
    pdf_page: 568,
  },

   {
    filename: '194.mp3',
    title: 'ክፍል 194',
    hadith_number_from: 1655,
    hadith_number_to: 1673,
    ordering: 194,
    pdf_page: 573,
  },

   {
    filename: '195.mp3',
    title: 'ክፍል 195',
    hadith_number_from: 1674,
    hadith_number_to: 1691,
    ordering: 195,
    pdf_page: 578,
  },

   {
    filename: '196.mp3',
    title: 'ክፍል 196',
    hadith_number_from: 1692,
    hadith_number_to: 1714,
    ordering: 196,
    pdf_page: 582,
  },

   {
    filename: '197.mp3',
    title: 'ክፍል 197',
    hadith_number_from: 1715,
    hadith_number_to: 1735,
    ordering: 197,
    pdf_page: 588,
  },

   {
    filename: '198.mp3',
    title: 'ክፍል 198',
    hadith_number_from: 1736,
    hadith_number_to: 1753,
    ordering: 198,
    pdf_page: 594,
  },

   {
    filename: '199.mp3',
    title: 'ክፍል 199',
    hadith_number_from: 1754,
    hadith_number_to: 1774,
    ordering: 199,
    pdf_page: 599,
  },

   {
    filename: '200.mp3',
    title: 'ክፍል 200',
    hadith_number_from: 1775,
    hadith_number_to: 1790,
    ordering: 200,
    pdf_page: 606,
  },

   {
    filename: '201.mp3',
    title: 'ክፍል 201',
    hadith_number_from: 1791,
    hadith_number_to: 1805,
    ordering: 201,
    pdf_page: 611,
  },

   {
    filename: '202.mp3',
    title: 'ክፍል 202',
    hadith_number_from: 1806,
    hadith_number_to: 1808,
    ordering: 202,
    pdf_page: 617,
  },

   {
    filename: '203.mp3',
    title: 'ክፍል 203',
    hadith_number_from: 1809,
    hadith_number_to: 1826,
    ordering: 203,
    pdf_page: 622,
  },

   {
    filename: '204.mp3',
    title: 'ክፍል 204',
    hadith_number_from: 1827,
    hadith_number_to: 1848,
    ordering: 204,
    pdf_page: 628,
  },

   {
    filename: '205.mp3',
    title: 'ክፍል 205',
    hadith_number_from: 1849,
    hadith_number_to: 1860,
    ordering: 205,
    pdf_page: 633,
  },

   {
    filename: '206.mp3',
    title: 'ክፍል 206',
    hadith_number_from: 1861,
    hadith_number_to: 1866,
    ordering: 206,
    pdf_page: 638,
  },

   {
    filename: '207.mp3',
    title: 'ክፍል 207',
    hadith_number_from: 1867,
    hadith_number_to: 1868,
    ordering: 207,
    pdf_page: 642,
  },

   {
    filename: '208.mp3',
    title: 'ክፍል 208',
    hadith_number_from: 1869,
    hadith_number_to: 1879,
    ordering: 208,
    pdf_page: 649,
  },

   {
    filename: '209.mp3',
    title: 'ክፍል 209',
    hadith_number_from: 1880,
    hadith_number_to: 1886,
    ordering: 209,
    pdf_page: 653,
  },

   {
    filename: '210.mp3',
    title: 'ክፍል 210',
    hadith_number_from: 1887,
    hadith_number_to: 1896,
    ordering: 210,
    pdf_page: 655,
  },
];

export default audios;
