import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

export default {
  // Configuration du plugin
  options: {
    api1: {
      url: process.env.MONDIAL_RELAY_API1_URL,
      enseigne: process.env.MONDIAL_RELAY_ENSEIGNE,
      privateKey: process.env.MONDIAL_RELAY_PRIVATE_KEY
    },
    api2: {
      baseUrl: process.env.MONDIAL_RELAY_API_BASE_URL,
      login: process.env.MONDIAL_RELAY_LOGIN,
      password: process.env.MONDIAL_RELAY_PASSWORD,
      customerId: process.env.MONDIAL_RELAY_CUSTOMER_ID
    },
    businessAddress: {
      title: process.env.BUSINESS_TITLE,
      firstname: process.env.BUSINESS_FIRSTNAME,
      lastname: process.env.BUSINESS_LASTNAME,
      streetname: process.env.BUSINESS_STREET,
      houseNo: process.env.BUSINESS_HOUSE_NO,
      countryCode: process.env.BUSINESS_COUNTRY_CODE,
      postCode: process.env.BUSINESS_POSTCODE,
      city: process.env.BUSINESS_CITY,
      phoneNo: process.env.BUSINESS_PHONE,
      mobileNo: process.env.BUSINESS_MOBILE,
      email: process.env.BUSINESS_EMAIL
    }
  }
}
