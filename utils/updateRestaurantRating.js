import Review from "../models/Review.js";
import Restaurant from "../models/Restaurant.js";

const updateRestaurantRating = async (restaurantId) => {
  const stats = await Review.aggregate([
    { $match: { restaurant: restaurantId } },
    {
      $group: {
        _id: "$restaurant",
        avgRating: { $avg: "$rating" },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      numReviews: stats[0].numReviews,
    });
  } else {
    await Restaurant.findByIdAndUpdate(restaurantId, { rating: 0, numReviews: 0 });
  }
};

export default updateRestaurantRating;