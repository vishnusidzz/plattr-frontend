// src/components/ImageCarousel.jsx
import React, { useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const ImageCarousel = ({ images = [], autoplay = true, height = 'h-40', rounded = 'rounded-xl' }) => {
  // Only approved image URLs
  const imgs = useMemo(() => {
    if (!Array.isArray(images) || images.length === 0) return [];

    return images
      .map((item) => {
        if (typeof item === 'string' && item.trim()) return item;
        if (item && typeof item === 'object') {
          if (Object.prototype.hasOwnProperty.call(item, 'is_approved') && !item.is_approved) {
            return null; // skip not approved
          }
          return item.image || item.url || item.path || null;
        }
        return null;
      })
      .filter((u) => typeof u === 'string' && u.trim());
  }, [images]);

  const single = imgs.length === 1;
  const autoplayCfg = !single && autoplay ? { delay: 3000, disableOnInteraction: false } : false;

  if (imgs.length === 0) {
    return null; // ⛔️ no images = render nothing
  }

  return (
    <Swiper
      modules={[Autoplay, Pagination, Navigation]}
      pagination={{ clickable: true }}
      navigation={!single}
      autoplay={autoplayCfg}
      loop={!single}
      className={`w-full ${height} ${rounded} overflow-hidden`}
    >
      {imgs.map((img, index) => (
        <SwiperSlide key={index}>
          <img
            src={img}
            alt={`Slide ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // if one image fails, hide it
              e.currentTarget.style.display = 'none';
            }}
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default ImageCarousel;