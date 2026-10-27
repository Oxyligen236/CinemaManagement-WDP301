export interface BoxOfficeItem {
  rank: number;
  grade: "18" | "13" | "16" | "P";
  title: string;
  duration: string;
  releaseDate: string;
  id: string;
}

export interface KeyVisualEvent {
  id: string;
  title: string;
  image: string;
  url?: string;
}

export interface TrailerItem {
  id: string;
  title: string;
  image: string;
  videoUrl?: string;
}

export interface MoviePosterItem {
  id: string;
  title: string;
  image: string;
  bookingUrl?: string;
  detailUrl?: string;
}

export interface EventBannerItem {
  id: string;
  title: string;
  image: string;
  width: number;
  height: number;
  url?: string;
}

export const BOX_OFFICE_MOVIES: BoxOfficeItem[] = [
  { rank: 1, grade: "18", title: "TRẠI BUÔN NGƯỜI", duration: "135Phút", releaseDate: "25/09/2026", id: "12349" },
  { rank: 2, grade: "18", title: "QUỶ ĂN TẠNG 4: HỔ TINH", duration: "111Phút", releaseDate: "16/10/2026", id: "12352" },
  { rank: 3, grade: "13", title: "BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Delayed Live)", duration: "195Phút", releaseDate: "25/10/2026", id: "12353" },
  { rank: 4, grade: "18", title: "ÁN MẠNG XÉM HOÀN HẢO", duration: "124Phút", releaseDate: "09/10/2026", id: "12321" },
  { rank: 5, grade: "13", title: "BTS WORLD TOUR ARIRANG IN SÃO PAULO: LIVE VIEWING (Delayed Live)", duration: "195Phút", releaseDate: "31/10/2026", id: "12355" },
  { rank: 6, grade: "18", title: "ÚT LAN 2", duration: "107Phút", releaseDate: "18/09/2026", id: "12307" },
  { rank: 7, grade: "18", title: "NGƯỜI MẸ KHÁC", duration: "93Phút", releaseDate: "09/10/2026", id: "12362" },
];

export const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_STORAGE_URL ||
  "https://pub-164d4a22a3b640eea0cda4f57ba0c1f9.r2.dev";

export const KEY_VISUAL_EVENTS: KeyVisualEvent[] = [
  { id: "1", title: "🍿 AMAZING DAY: THỨ 3 XEM PHIM CHỈ VỚI 65.000Đ! 🍿", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/fc4f9868f66944c4a6b8996e597f2f81.jpg` },
  { id: "2", title: "Mua 2 vé chỉ 95,000đ với thẻ TPBank", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/caf7f074dcfe4e66bccb76e73fad261f.jpg` },
  { id: "3", title: "Siêu Ưu Đãi Đồng Giá Vé Lotte Chỉ Từ 81K Trên Ứng Dụng Ngân Hàng & VNPAY", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/99183da3d06540dfade3639fd1d2535d.jpg` },
  { id: "4", title: "Mua 02 vé xem phim 2D với giá 95,000đ", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/a58e865a95e84039a720bc0585e51fde.png` },
  { id: "5", title: "Mô hình Doraemon Xin Chào Việt Nam", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/82bcfc38268941ff87fbb3c751ae6d1e.jpg` },
  { id: "6", title: "Mang sự vô tri đi muôn nơi với keycap Én", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/be8a5fb0dd844819b8acec85e4ef2cca.jpg` },
  { id: "7", title: "Quỳnh Aka - đồ chơi vô tri", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/981a000d273344e6b3222eff06a9631a.jpg` },
  { id: "8", title: "Quai xách đa năng Drink Carrier (Phiên bản mới)", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/5d055495d86248d683a02d2398a10296.jpg` },
  { id: "9", title: "Chị Chị Em Em 3 (Merchandise)", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/998d70e0d4b04cbf9c5ad7da235f3098.jpg` },
  { id: "10", title: "Kèo HOT cho U22: Vé nhóm 3 người chỉ 99,000đ", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/ca71abe8a8b7467a863f666fbebf75b0.jpg` },
  { id: "11", title: "FAMILY DAY - THỨ 4 ƯU ĐÃI", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/b5fe97ebdaab46299ce539027fff755c.jpg` },
  { id: "12", title: "ONE PIECE Collection | Mini notebook Wanted poster", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/498f5d76a2d241259a6c2dd1250746fd.jpg` },
  { id: "13", title: "ONE PIECE Collection | Bộ dây đeo & thẻ ID", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/22cd62825c39497c942ebcfe08218bf6.jpg` },
  { id: "14", title: "ONE PIECE Collection | Móc khóa xoay", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/3592c114d6d34815a335ce5cf776b2b2.jpg` },
  { id: "15", title: "Đặt vé giảm 50% & Tích xu đổi quà độc quyền", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/71e8b46c8580420c87875db63087cefe.png` },
  { id: "16", title: "THÔNG BÁO QUYỀN LỢI THÀNH VIÊN 2026", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/keyvisual/469f3c4df24e43ad8d60f10242f342ed.jpg` },
];

export const TRAILERS: TrailerItem[] = [
  { id: "12353", title: "BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Delayed Live)", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12353_105_100001.jpg` },
  { id: "12307", title: "ÚT LAN 2", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12307_105_100004.jpg` },
  { id: "12349", title: "TRẠI BUÔN NGƯỜI", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12349_105_100002.jpg` },
  { id: "12374", title: "Stray Kids World Tour RUN IT LIVE VIEWING", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12374_105_100001.jpg` },
  { id: "12308", title: "ÁN MẠNG KARAOKE", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12308_105_100003.jpg` },
  { id: "12314", title: "CHỊ CHỊ EM EM 3", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12314_105_100002.jpg` },
  { id: "12352", title: "QUỶ ĂN TẠNG 4: HỔ TINH", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12352_105_100003.jpg` },
  { id: "12300", title: "MẸ MÌN", image: `${R2_PUBLIC_URL}/sites/lottecinemavn/trailer/12300_105_100002.jpg` },
];

export const MOVIE_POSTERS: MoviePosterItem[][] = [
  [
    { id: "12349", title: "TRẠI BUÔN NGƯỜI", image: `${R2_PUBLIC_URL}/movies/posters/12349_101_100002.jpg` },
    { id: "12352", title: "QUỶ ĂN TẠNG 4: HỔ TINH", image: `${R2_PUBLIC_URL}/movies/posters/12352_101_100003.jpg` },
    { id: "12353", title: "BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Delayed Live)", image: `${R2_PUBLIC_URL}/movies/posters/12353_101_100002.jpg` },
    { id: "12321", title: "ÁN MẠNG XÉM HOÀN HẢO", image: `${R2_PUBLIC_URL}/movies/posters/12321_101_100003.jpg` },
    { id: "12355", title: "BTS WORLD TOUR ARIRANG IN SÃO PAULO: LIVE VIEWING (Delayed Live)", image: `${R2_PUBLIC_URL}/movies/posters/12355_101_100003.jpg` },
  ],
  [
    { id: "12307", title: "ÚT LAN 2", image: `${R2_PUBLIC_URL}/movies/posters/12307_101_100002.jpg` },
    { id: "12362", title: "NGƯỜI MẸ KHÁC", image: `${R2_PUBLIC_URL}/movies/posters/12362_101_100002.jpg` },
    { id: "12356", title: "BTS WORLD TOUR ARIRANG IN SÃO PAULO: LIVE VIEWING (Encore)", image: `${R2_PUBLIC_URL}/movies/posters/12356_101_100002.jpg` },
    { id: "12354", title: "BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Encore)", image: `${R2_PUBLIC_URL}/movies/posters/12354_101_100002.jpg` },
    { id: "12351", title: "ALWAYS LALISA", image: `${R2_PUBLIC_URL}/movies/posters/12351_101_100001.jpg` },
  ],
  [
    { id: "12339", title: "AVENGERS: HỒI KẾT - PHIÊN BẢN ĐẶC BIỆT", image: `${R2_PUBLIC_URL}/movies/posters/12339_101_100002.jpg` },
    { id: "12258", title: "PHIM SHIN – CẬU BÉ BÚT CHÌ: KỲ KỲ QUÁI QUÁI KỲ NGHỈ YÊU QUÁI CỦA TỚ", image: `${R2_PUBLIC_URL}/movies/posters/12258_101_100006.jpg` },
    { id: "12202", title: "PHIM STREET FIGHTER", image: `${R2_PUBLIC_URL}/movies/posters/12202_101_100001.jpg` },
    { id: "12368", title: "BLUE LOCK: CUỘC CHIẾN CỦA NHỮNG TIỀN ĐẠO", image: `${R2_PUBLIC_URL}/movies/posters/12368_101_100001.jpg` },
    { id: "12358", title: "GIẢI CỨU HOÀNG THƯỢNG", image: `${R2_PUBLIC_URL}/movies/posters/12358_101_100001.jpg` },
  ],
  [
    { id: "12369", title: "SHAUN THE SHEEP: “QUÁI LẠ” GHÉ NHÀ", image: `${R2_PUBLIC_URL}/movies/posters/12369_101_100001.jpg` },
    { id: "12308", title: "ÁN MẠNG KARAOKE", image: `${R2_PUBLIC_URL}/movies/posters/12308_101_100003.jpg` },
    { id: "12344", title: "BÍ MẬT BỊ CHÔN VÙI", image: `${R2_PUBLIC_URL}/movies/posters/12344_101_100001.jpg` },
    { id: "12277", title: "LÊN HƯƠNG", image: `${R2_PUBLIC_URL}/movies/posters/12277_101_100003.jpg` },
  ],
];

export const CINEMA_REGIONS = [
  {
    region: "TPHCM",
    cinemas: [
      "Cantavil", "Cộng Hòa", "Gò Vấp", "Gold View", "Moonlight",
      "Nam Sài Gòn", "Phú Thọ", "Thủ Đức"
    ],
  },
  {
    region: "Hà Nội",
    cinemas: ["Hà Đông", "Kosmo", "West Lake"],
  },
  {
    region: "ĐB Sông Hồng",
    cinemas: [
      "Bắc Giang", "Bắc Ninh", "Hải Dương", "Hải Phòng",
      "Nam Định", "Ninh Bình", "Phủ Lý", "Thái Bình"
    ],
  },
  {
    region: "Đông Bắc, Tây Bắc",
    cinemas: ["Hạ Long", "Tuyên Quang", "Việt Trì"],
  },
  {
    region: "Bắc Miền Trung",
    cinemas: ["Đồng Hới", "Huế", "Thanh Hóa", "Vinh"],
  },
  {
    region: "Nam Miền Trung",
    cinemas: [
      "Bảo Lộc", "Đà Nẵng", "Hội An", "Nha Trang Thái Nguyên",
      "Nha Trang Trần Phú", "Phan Rang", "Phan Thiết"
    ],
  },
  {
    region: "Đông Nam Bộ",
    cinemas: ["Biên Hòa", "Bình Dương", "Dĩ An", "Đồng Nai", "Tây Ninh", "Vũng Tàu"],
  },
  {
    region: "Tây Nam Bộ",
    cinemas: ["Cà Mau", "Cần Thơ Cái Răng", "Cần Thơ Ninh Kiều", "Long Xuyên"],
  },
];
