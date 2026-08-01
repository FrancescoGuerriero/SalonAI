import Customer from "../models/customer.js";

/*
|--------------------------------------------------------------------------
| Create Customer
|--------------------------------------------------------------------------
*/
export async function createCustomer(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      hairProfile,
      preferredStylist,
      notes,
      marketing,
      photo,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        message: "First name and last name are required.",
      });
    }

    if (email) {
      const existingEmail = await Customer.findOne({
        email: email.toLowerCase(),
        status: { $ne: "deleted" },
      });

      if (existingEmail) {
        return res.status(409).json({
          message: "Email already exists.",
        });
      }
    }

    if (phone) {
      const existingPhone = await Customer.findOne({
        phone,
        status: { $ne: "deleted" },
      });

      if (existingPhone) {
        return res.status(409).json({
          message: "Phone number already exists.",
        });
      }
    }

    const customer = await Customer.create({
      firstName,
      lastName,
      email: email?.toLowerCase(),
      phone,
      dateOfBirth,
      gender,
      hairProfile,
      preferredStylist,
      notes,
      marketing,
      photo,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    });

    return res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Get Customers
|--------------------------------------------------------------------------
*/
export async function getCustomers(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const search = req.query.search || "";

    const filter = {
      status: { $ne: "deleted" },
    };

    if (search) {
      filter.$text = {
        $search: search,
      };
    }

    const customers = await Customer.find(filter)
      .populate("preferredStylist", "firstName lastName")
      .sort({
        createdAt: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Customer.countDocuments(filter);

    return res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      customers,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Get Customer
|--------------------------------------------------------------------------
*/
export async function getCustomer(req, res) {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate("preferredStylist");

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    return res.json(customer);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Update Customer
|--------------------------------------------------------------------------
*/
export async function updateCustomer(req, res) {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    Object.assign(customer, req.body);

    customer.updatedBy = req.user?.id;

    await customer.save();

    return res.json(customer);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Archive Customer
|--------------------------------------------------------------------------
*/
export async function archiveCustomer(req, res) {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    customer.status = "archived";
    customer.updatedBy = req.user?.id;

    await customer.save();

    return res.json({
      message: "Customer archived successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Restore Customer
|--------------------------------------------------------------------------
*/
export async function restoreCustomer(req, res) {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    customer.status = "active";
    customer.updatedBy = req.user?.id;

    await customer.save();

    return res.json({
      message: "Customer restored successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Delete Customer (Soft Delete)
|--------------------------------------------------------------------------
*/
export async function deleteCustomer(req, res) {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    customer.status = "deleted";
    customer.updatedBy = req.user?.id;

    await customer.save();

    return res.json({
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message,
    });
  }
}