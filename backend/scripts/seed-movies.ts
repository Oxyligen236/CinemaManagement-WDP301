import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  Movie,
  MovieSchema,
} from '../src/modules/movie/domain/schemas/movie.schema';
import {
  Genre,
  GenreSchema,
} from '../src/modules/movie/domain/schemas/genre.schema';
import { MovieStatus } from '../src/modules/movie/domain/enums/movie-status.enum';

function loadEnvMap(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../.env');
  const map: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        map[key] = val;
      }
    }
  }
  return map;
}

function getMongoUri(): string {
  const env = loadEnvMap();
  return env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/wdp';
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

interface SeedGenreItem {
  genreId: string;
  genreName: string;
  genreDescription: string;
}

interface SeedMovieItem {
  movieId: string;
  movieName: string;
  duration: number;
  status: MovieStatus;
  releaseDate: string;
  posterUrl: string;
  description: string;
  genreIds: string[];
}

const GENRES: SeedGenreItem[] = [
  {
    genreId: 'genre-action',
    genreName: 'Hành Động',
    genreDescription: 'Phim hành động kịch tính, võ thuật và rượt đuổi.',
  },
  {
    genreId: 'genre-horror',
    genreName: 'Kinh Dị',
    genreDescription: 'Phim kinh dị, tâm linh và bí ẩn rùng rợn.',
  },
  {
    genreId: 'genre-thriller',
    genreName: 'Tâm Lý - Giật Gân',
    genreDescription: 'Phim điều tra phá án, tâm lý tội phạm căng thẳng.',
  },
  {
    genreId: 'genre-animation',
    genreName: 'Hoạt Hình',
    genreDescription: 'Phim hoạt hình dành cho gia đình và thanh thiếu niên.',
  },
  {
    genreId: 'genre-music',
    genreName: 'Âm Nhạc - Concert',
    genreDescription: 'Phim tài liệu âm nhạc và truyền hình trực tiếp concert.',
  },
  {
    genreId: 'genre-comedy',
    genreName: 'Hài Hước',
    genreDescription: 'Phim hài giải trí vui nhộn.',
  },
  {
    genreId: 'genre-drama',
    genreName: 'Tình Cảm - Gia Đình',
    genreDescription: 'Phim chính kịch, tâm lý gia đình và xã hội.',
  },
];

const MOVIES: SeedMovieItem[] = [
  {
    movieId: '12349',
    movieName: 'TRẠI BUÔN NGƯỜI',
    duration: 135,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-25',
    posterUrl: '/sites/lottecinemavn/posters/12349_101_100002.jpg',
    description:
      'Cuộc giải cứu nghẹt thở khỏi đường dây tội phạm xuyên biên giới đầy hiểm nguy.',
    genreIds: ['genre-action', 'genre-thriller'],
  },
  {
    movieId: '12352',
    movieName: 'QUỶ ĂN TẠNG 4: HỔ TINH',
    duration: 111,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-16',
    posterUrl: '/sites/lottecinemavn/posters/12352_101_100003.jpg',
    description:
      'Sự trở lại kinh hoàng của ác linh cổ xưa ẩn mình trong khu rừng cấm.',
    genreIds: ['genre-horror', 'genre-thriller'],
  },
  {
    movieId: '12353',
    movieName:
      'BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Delayed Live)',
    duration: 195,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-25',
    posterUrl: '/sites/lottecinemavn/posters/12353_101_100002.jpg',
    description:
      'Trải nghiệm không khí bùng nổ của đêm diễn BTS World Tour tại Buenos Aires ngay trên màn ảnh rộng.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12321',
    movieName: 'ÁN MẠNG XÉM HOÀN HẢO',
    duration: 124,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-09',
    posterUrl: '/sites/lottecinemavn/posters/12321_101_100003.jpg',
    description:
      'Kế hoạch ngoại phạm tưởng chừng không kẽ hở bất ngờ bị đảo lộn bởi những tình tiết dở khóc dở cười.',
    genreIds: ['genre-thriller', 'genre-comedy'],
  },
  {
    movieId: '12355',
    movieName:
      'BTS WORLD TOUR ARIRANG IN SÃO PAULO: LIVE VIEWING (Delayed Live)',
    duration: 195,
    status: MovieStatus.COMING_SOON,
    releaseDate: '2026-10-31',
    posterUrl: '/sites/lottecinemavn/posters/12355_101_100003.jpg',
    description:
      'Buổi trình chiếu trực tiếp concert BTS World Tour rực lửa tại São Paulo.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12307',
    movieName: 'ÚT LAN 2',
    duration: 107,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-18',
    posterUrl: '/sites/lottecinemavn/posters/12307_101_100002.jpg',
    description:
      'Bí mật tâm linh chưa lời giải tiếp tục ám ảnh ngôi làng miền Tây sông nước.',
    genreIds: ['genre-horror', 'genre-drama'],
  },
  {
    movieId: '12362',
    movieName: 'NGƯỜI MẸ KHÁC',
    duration: 93,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-09',
    posterUrl: '/sites/lottecinemavn/posters/12362_101_100002.jpg',
    description:
      'Những hiện tượng kỳ lạ xảy đến trong gia đình nhỏ khi người mẹ dần thay đổi thành một con người hoàn toàn khác.',
    genreIds: ['genre-horror', 'genre-thriller'],
  },
  {
    movieId: '12356',
    movieName: 'BTS WORLD TOUR ARIRANG IN SÃO PAULO: LIVE VIEWING (Encore)',
    duration: 195,
    status: MovieStatus.COMING_SOON,
    releaseDate: '2026-11-02',
    posterUrl: '/sites/lottecinemavn/posters/12356_101_100002.jpg',
    description:
      'Suất chiếu Encore đặc biệt của đêm nhạc BTS World Tour tại São Paulo.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12354',
    movieName: 'BTS WORLD TOUR ARIRANG IN BUENOS AIRES: LIVE VIEWING (Encore)',
    duration: 195,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-26',
    posterUrl: '/sites/lottecinemavn/posters/12354_101_100002.jpg',
    description:
      'Suất chiếu Encore đặc biệt của đêm nhạc BTS World Tour tại Buenos Aires.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12351',
    movieName: 'ALWAYS LALISA',
    duration: 105,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-15',
    posterUrl: '/sites/lottecinemavn/posters/12351_101_100001.jpg',
    description:
      'Hành trình âm nhạc và những khoảnh khắc hậu trường độc quyền trên sân khấu quốc tế.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12339',
    movieName: 'AVENGERS: HỒI KẾT - PHIÊN BẢN ĐẶC BIỆT',
    duration: 181,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-01',
    posterUrl: '/sites/lottecinemavn/posters/12339_101_100002.jpg',
    description:
      'Trận chiến vĩ đại nhất vũ trụ điện ảnh trở lại màn ảnh rộng với định dạng hình ảnh và âm thanh nâng cấp.',
    genreIds: ['genre-action'],
  },
  {
    movieId: '12258',
    movieName:
      'PHIM SHIN – CẬU BÉ BÚT CHÌ: KỲ KỲ QUÁI QUÁI KỲ NGHỈ YÊU QUÁI CỦA TỚ',
    duration: 100,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-20',
    posterUrl: '/sites/lottecinemavn/posters/12258_101_100006.jpg',
    description:
      'Kỳ nghỉ hè đầy ắp tiếng cười và những cuộc phiêu lưu kỳ thú của gia đình nhóc Shin.',
    genreIds: ['genre-animation', 'genre-comedy'],
  },
  {
    movieId: '12202',
    movieName: 'PHIM STREET FIGHTER',
    duration: 118,
    status: MovieStatus.COMING_SOON,
    releaseDate: '2026-11-10',
    posterUrl: '/sites/lottecinemavn/posters/12202_101_100001.jpg',
    description:
      'Giải đấu võ thuật sinh tử quy tụ những chiến binh mạnh nhất thế giới.',
    genreIds: ['genre-action'],
  },
  {
    movieId: '12368',
    movieName: 'BLUE LOCK: CUỘC CHIẾN CỦA NHỮNG TIỀN ĐẠO',
    duration: 95,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-12',
    posterUrl: '/sites/lottecinemavn/posters/12368_101_100001.jpg',
    description:
      'Dự án tuyển chọn khắc nghiệt nhằm tìm ra tiền đạo xuất sắc nhất cho bóng đá Nhật Bản.',
    genreIds: ['genre-animation', 'genre-action'],
  },
  {
    movieId: '12358',
    movieName: 'GIẢI CỨU HOÀNG THƯỢNG',
    duration: 102,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-18',
    posterUrl: '/sites/lottecinemavn/posters/12358_101_100001.jpg',
    description:
      'Phi vụ giải cứu hài hước nhưng không kém phần gay cấn của đội cận vệ bất đắc dĩ.',
    genreIds: ['genre-comedy', 'genre-action'],
  },
  {
    movieId: '12369',
    movieName: 'SHAUN THE SHEEP: “QUÁI LẠ” GHÉ NHÀ',
    duration: 87,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-05',
    posterUrl: '/sites/lottecinemavn/posters/12369_101_100001.jpg',
    description:
      'Chú cừu Shaun và đàn cừu tinh nghịch bước vào cuộc phiêu lưu giải cứu vị khách ngoài hành tinh.',
    genreIds: ['genre-animation', 'genre-comedy'],
  },
  {
    movieId: '12308',
    movieName: 'ÁN MẠNG KARAOKE',
    duration: 110,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-28',
    posterUrl: '/sites/lottecinemavn/posters/12308_101_100003.jpg',
    description:
      'Đêm tụ tập ca hát biến thành hiện trường vụ án ly kỳ khi từng bí mật đen tối bị phơi bày.',
    genreIds: ['genre-thriller', 'genre-horror'],
  },
  {
    movieId: '12344',
    movieName: 'BÍ MẬT BỊ CHÔN VÙI',
    duration: 115,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-08',
    posterUrl: '/sites/lottecinemavn/posters/12344_101_100001.jpg',
    description:
      'Hành trình lần theo manh mối từ vụ mất tích cách đây 10 năm mở ra sự thật gây chấn động.',
    genreIds: ['genre-thriller', 'genre-drama'],
  },
  {
    movieId: '12277',
    movieName: 'LÊN HƯƠNG',
    duration: 108,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-15',
    posterUrl: '/sites/lottecinemavn/posters/12277_101_100003.jpg',
    description:
      'Câu chuyện tâm linh mang đậm màu sắc văn hóa dân gian và nhân quả gia tộc.',
    genreIds: ['genre-horror', 'genre-drama'],
  },
  {
    movieId: '12374',
    movieName: 'Stray Kids World Tour RUN IT LIVE VIEWING',
    duration: 180,
    status: MovieStatus.COMING_SOON,
    releaseDate: '2026-11-05',
    posterUrl: '/sites/lottecinemavn/trailer/12374_105_100001.jpg',
    description:
      'Buổi trình chiếu trực tiếp concert vòng quanh thế giới đầy năng lượng của Stray Kids.',
    genreIds: ['genre-music'],
  },
  {
    movieId: '12314',
    movieName: 'CHỊ CHỊ EM EM 3',
    duration: 116,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-10-10',
    posterUrl: '/sites/lottecinemavn/trailer/12314_105_100002.jpg',
    description:
      'Cuộc đối đầu sắc sảo giữa danh vọng, tình thân và những âm mưu khó lường.',
    genreIds: ['genre-drama', 'genre-thriller'],
  },
  {
    movieId: '12300',
    movieName: 'MẸ MÌN',
    duration: 104,
    status: MovieStatus.NOW_SHOWING,
    releaseDate: '2026-09-22',
    posterUrl: '/sites/lottecinemavn/trailer/12300_105_100002.jpg',
    description:
      'Cuộc truy đuổi nghẹt thở của người mẹ quyết tâm tìm lại đứa con bị bắt cóc.',
    genreIds: ['genre-thriller', 'genre-drama'],
  },
];

async function seedMovies() {
  const env = loadEnvMap();
  const s3Client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION || 'auto',
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || '',
    },
  });
  const bucket = env.STORAGE_BUCKET || 'cms-assets';
  const publicBaseUrl = (env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '');

  // 0. Upload all local images in frontend/public/sites/lottecinemavn to Cloudflare R2
  const publicRoot = path.resolve(__dirname, '../../frontend/public');
  const lotteRoot = path.join(publicRoot, 'sites/lottecinemavn');
  const localImages = walkFiles(lotteRoot);
  console.log(`Uploading ${localImages.length} local images to Cloudflare R2 (${bucket})...`);

  for (const fullPath of localImages) {
    const relKey = path.relative(publicRoot, fullPath).replace(/\\/g, '/');
    const body = fs.readFileSync(fullPath);
    const contentType = getContentType(fullPath);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relKey,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }
  console.log(`Uploaded ${localImages.length} site assets to Cloudflare R2 under 'sites/lottecinemavn/*'.`);

  const mongoUri = getMongoUri();
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  const GenreM =
    mongoose.models[Genre.name] || mongoose.model(Genre.name, GenreSchema);
  const MovieM =
    mongoose.models[Movie.name] || mongoose.model(Movie.name, MovieSchema);

  // 1. Seed Genres
  for (const g of GENRES) {
    await GenreM.updateOne(
      { genreId: g.genreId },
      {
        $set: {
          genreName: g.genreName,
          genreDescription: g.genreDescription,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Upserted ${GENRES.length} genres.`);

  // 2. Upload movie posters to movies/posters/* on R2 & Seed Movies
  for (const m of MOVIES) {
    const localFile = path.join(publicRoot, m.posterUrl.replace(/^\/+/, ''));
    const fileName = path.basename(localFile);
    const posterKey = `movies/posters/${fileName}`;
    const r2PosterUrl = `${publicBaseUrl}/${posterKey}`;

    if (fs.existsSync(localFile)) {
      const body = fs.readFileSync(localFile);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: posterKey,
          Body: body,
          ContentType: getContentType(localFile),
          ContentLength: body.length,
        }),
      );
    }

    await MovieM.updateOne(
      { movieId: m.movieId },
      {
        $set: {
          movieName: m.movieName,
          duration: m.duration,
          status: m.status,
          releaseDate: new Date(m.releaseDate),
          posterKey,
          posterUrl: r2PosterUrl,
          description: m.description,
          genreIds: m.genreIds,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Upserted ${MOVIES.length} movies with Cloudflare R2 posterKey & posterUrl.`);

  await mongoose.disconnect();
  console.log('Cloudflare R2 upload & Movie seeding completed successfully!');
}

seedMovies().catch(async (err) => {
  console.error('Failed to seed movies:', err);
  await mongoose.disconnect();
  process.exit(1);
});
