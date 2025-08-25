const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS Middleware - Bu satırları ekleyin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Tüm domainlere izin ver
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // OPTIONS preflight request'leri için
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer ayarları
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ✅ 1. Resim Yükleme
app.post("/upload-image", upload.single("resim"), async (req, res) => {
  try {
    const { firma_id, urun_id, aciklama } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Resim dosyası gerekli" });
    }

    const resim_url = `https://resim.hggrup.com/uploads/${req.file.filename}`;
    const aktif = true;

    const siranoQuery = await pool.query(
      "SELECT COALESCE(MAX(sira_no), 0) + 1 AS next_sira FROM urun_resimleri WHERE urun_id = $1",
      [urun_id]
    );
    const sirano = siranoQuery.rows[0].next_sira;

    await pool.query(
      `INSERT INTO urun_resimleri (urun_id, resim_url, sira_no, aciklama, aktif)
       VALUES ($1, $2, $3, $4, $5)`,
      [urun_id, resim_url, sirano, aciklama, aktif]
    );

    res.status(200).json({
      message: "Resim yüklendi",
      resim_url: `${req.protocol}://${req.get("host")}${resim_url}`,
    });
  } catch (error) {
    console.error("Yükleme hatası:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ✅ 2. Resim Silme
app.delete("/delete-image/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await pool.query("SELECT resim_url FROM urun_resimleri WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Resim bulunamadı" });
    }

    const filePath = path.join(__dirname, result.rows[0].resim_url);

    // Veritabanından sil
    await pool.query("DELETE FROM urun_resimleri WHERE id = $1", [id]);

    // Dosyayı diskte sil
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn("Dosya silinemedi veya yok:", filePath);
      }
    });

    res.status(200).json({ message: "Resim silindi" });
  } catch (error) {
    console.error("Silme hatası:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ✅ 3. Resim Güncelleme (yeni dosya yükleyerek)
app.put("/update-image/:id", upload.single("resim"), async (req, res) => {
  try {
    const id = req.params.id;
    const { aciklama } = req.body;

    const result = await pool.query("SELECT resim_url FROM urun_resimleri WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Resim kaydı bulunamadı" });
    }

    let yeni_resim_url = result.rows[0].resim_url;

    // Eğer yeni bir resim yüklendiyse, eskisini sil ve yenisini kaydet
    if (req.file) {
      const eskiDosya = path.join(__dirname, result.rows[0].resim_url);
      fs.unlink(eskiDosya, (err) => {
        if (err) console.warn("Eski resim silinemedi:", eskiDosya);
      });

      yeni_resim_url = `/uploads/${req.file.filename}`;
    }

    // Veritabanını güncelle
    await pool.query(
      `UPDATE urun_resimleri 
       SET resim_url = $1, aciklama = $2 
       WHERE id = $3`,
      [yeni_resim_url, aciklama, id]
    );

    res.status(200).json({
      message: "Resim güncellendi",
      resim_url: `${req.protocol}://${req.get("host")}${yeni_resim_url}`,
    });
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});