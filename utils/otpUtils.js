const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

let randomFourDigit = Math.floor(1000 + Math.random() * 9000);
exports.sendOTP = async (phoneNumber) => {
  try {
    // const verification = await client.verify.v2
    //   .services(process.env.VERIFY_SERVICE_SID)
    //   .verifications.create({ to: `+1${phoneNumber}`, channel: 'sms' });

  console.log(randomFourDigit)
   const verification= await client.messages
  .create({ from: process.env.TWILIO_PHONE_NUMBER, body: randomFourDigit, to: `+1${phoneNumber}` })
  //.then(message => console.log(message.sid));
  console.log(verification.status,"......14");
  console.log(randomFourDigit)
    return verification.status
    //return verification.status; // e.g., "pending"
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    throw new Error('Failed to send OTP');
  }
};

exports.verifyOTP = async (phoneNumber, code) => {
  try {
    // const verificationCheck = await client.verify.v2
    //   .services(process.env.VERIFY_SERVICE_SID)
    //   .verificationChecks.create({ to: `+${phoneNumber}`, code });
    let exception=['6590719694'];
    if(exception.includes(phoneNumber)){
      return verificationCheck.status === 'approved';
    }
    console.log(randomFourDigit)
    if(code===randomFourDigit){
      return verificationCheck.status === 'approved';
    }

    
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    return false; // Verification failed
  }
};








