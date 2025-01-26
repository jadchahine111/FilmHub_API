const { body, validationResult } = require("express-validator")
const User = require("../models/userModel")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const sgMail = require("@sendgrid/mail")
const crypto = require("crypto")

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// Function to send verification email using SendGrid
const sendVerificationEmail = async user => {
  const url = `${process.env.FRONTEND_URL}/verify-email/${user.verificationToken}`

  const msg = {
    to: user.email,
    from: process.env.EMAIL_USER,
    subject: "Email Verification",
    html: `<p>Please verify your email by clicking the following link:</p><a href="${url}">Verify Email</a>`
  }

  try {
    await sgMail.send(msg)
    console.log("Verification email sent to:", user.email)
  } catch (error) {
    console.error("Error sending verification email:", error)
    if (error.response) {
      console.error(error.response.body)
    }
  }
}

// Regular signup
const signup = [

  
  // Validate and sanitize input (unchanged)
  // ...

  // Handle the request
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, email, password } = req.body
    try {
      let user = await User.findOne({ email })

      if (user) {
        return res.status(400).json({ message: "User already exists" })
      }
      user = new User({ name, email, password, isVerified: false })

      // Hash password before saving
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(password, salt)

      // Generate verification token
      user.verificationToken = crypto.randomBytes(32).toString("hex")

      await user.save()

      // Send verification email using the stored token
      await sendVerificationEmail(user)

      res
        .status(201)
        .json({
          message:
            "Signup successful. Please check your email for verification."
        })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
]

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.password) {
      return res.status(400).json({
        message: "This email is registered via Google. Please log in using Google."
      });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.isVerified) {
      user.verificationToken = crypto.randomBytes(32).toString("hex");
      await user.save();
      await sendVerificationEmail(user);
      return res.status(403).json({
        message: "Email not verified. A verification email has been sent to you."
      });
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });

    await user.save();

    // Set HTTP-only cookies for accessToken
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });


    res.json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};










// Email verification endpoint (isVerified make it true!)
const verifyEmail = async (req, res) => {
  const { token } = req.params; // Extract token from the URL

  try {
    // Verify the email verification token directly (don't use JWT for this)
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(404).json({ message: 'Invalid or expired verification token' });
    }

    // Check if the user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Update the user's verification status
    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token once verified
    await user.save();

    // Send a success response or render a view
    res.status(200).send(`
      <html>
        <body>
          <h1>Email verified successfully!</h1>
          <p>You can now log in to your account.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};



const checkVerificationStatus = async (req, res) => {
  const { email } = req.params; 
  try {
      const user = await User.findOne({ email });
      
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Respond with verification status
      return res.status(200).json({
          isVerified: user.isVerified, // Use this for the verification status
          message: user.isVerified ? 'User has verified their account' : 'User has not verified their account'
      });
  } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const signout = async (req, res) => {
  // Clear the cookies
  res.clearCookie("accessToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "none" });


  res.json({ message: "Logged out successfully" });
};


const checkAuth = async (req, res) => {
  const { accessToken } = req.cookies;

  if (!accessToken) {
    return res.status(401).json({ message: "Access token not found" });
  }

  try {
    // Verify the access token
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    
    // Find the user by ID
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }

    // If everything is okay, send a success response
    res.json({ message: "Authenticated", user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Access token expired" });
    }
    return res.status(403).json({ message: "Invalid access token" });
  }
};


module.exports = {
  signup,
  login,
  signout,
  verifyEmail,
  sendVerificationEmail,
  checkVerificationStatus,
  checkAuth
};
