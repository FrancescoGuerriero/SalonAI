import Stylist from "../models/Stylist.js";

/*
    GET /api/stylists
    Public
*/
export async function getStylists(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      active,
      sort = "firstName"
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i"
          }
        },
        {
          lastName: {
            $regex: search,
            $options: "i"
          }
        },
        {
          specialties: {
            $regex: search,
            $options: "i"
          }
        }
      ];
    }

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    const total = await Stylist.countDocuments(filter);

    const stylists = await Stylist.find(filter)
      .populate("services")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      stylists
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
}

/*
    GET /api/stylists/:id
*/
export async function getStylist(req, res) {
  try {

    const stylist = await Stylist.findById(req.params.id)
      .populate("services");

    if (!stylist) {
      return res.status(404).json({
        message: "Stylist not found"
      });
    }

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
}

/*
    POST /api/stylists
*/
export async function createStylist(req, res) {

  try {

    const stylist = await Stylist.create(req.body);

    const populated = await Stylist.findById(stylist._id)
      .populate("services");

    res.status(201).json(populated);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    PUT /api/stylists/:id
*/
export async function updateStylist(req, res) {

  try {

    const stylist = await Stylist.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate("services");

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    DELETE /api/stylists/:id
*/
export async function deleteStylist(req, res) {

  try {

    const stylist = await Stylist.findByIdAndDelete(
      req.params.id
    );

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    res.json({
      message: "Stylist deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    PATCH /api/stylists/:id/status
*/
export async function toggleStylistStatus(req, res) {

  try {

    const stylist = await Stylist.findById(
      req.params.id
    );

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    stylist.isActive = !stylist.isActive;

    await stylist.save();

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}