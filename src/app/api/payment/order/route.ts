import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Missing Razorpay configuration");
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: "receipt_1",
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to create Razorpay order", error);

    return NextResponse.json(
      { error: "Failed to create Razorpay order" },
      { status: 500 },
    );
  }
}
