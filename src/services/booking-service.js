const axios = require('axios');

const { BookingRepository } = require('../repository/index')
const { FLIGHT_SERVICE_PATH } = require('../config/serverConfig')
const { ServiceError } = require('../utils/error/index')

const { StatusCodes } = require('http-status-codes');

class BookingService {
    constructor() {
        this.bookingRepository = new BookingRepository();
    }

    async createBooking(data) {
        try {
            const flightId = data.flightId;
            const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flight/${flightId}`;
            const response = await axios.get(getFlightRequestURL);
            const flightData = response.data.data;
            let priceOfTheFlight = flightData.price

            if(data.noOfSeats > flightData.totalSeats){
                throw new ServiceError('Somthing went in the booking process', 'Insufficient seats in the flight');
            }
            const totalCost = priceOfTheFlight * data.noOfSeats;
            const bookingPayload = {...data, totalCost};
            const booking = await this.bookingRepository.create(bookingPayload);
    
            const updateFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
            await axios.patch(updateFlightRequestURL, {totalSeats:flightData.totalSeats - booking.noOfSeats});
            const updatedBooking = await this.bookingRepository.update(booking.id, {status: "Booked"});
            return updatedBooking;

        } catch (error) {
            if(error.name == 'RepositoryError' || error.name == 'ValidationError') {
                throw error;
            }
            throw new ServiceError();
        }
    }

    async cancelBooking(bookingId) {
        try {
            const booking = await this.bookingRepository.getBooking(bookingId);
            if(!booking){
                throw new ServiceError(
                    'Booking not fount',
                    'No booking exists with this id',
                    StatusCodes.NOT_FOUND
                );
            }
            if (booking.status === 'Cancelled'){
                throw new ServiceError(
                    'Booking already cancelled',
                    'This booking has already been cancelled',
                    StatusCodes.CONFLICT
                );
            }

            const flightId = booking.flightId;
            const getFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flight/${flightId}`;
            const response = await axios.get(getFlightRequestURL);
            const flightData = response.data.data;

            const updataTotalSeats = flightData.totalSeats + booking.noOfSeats;
            const updataFlightRequestURL = `${FLIGHT_SERVICE_PATH}/api/v1/flights/${booking.flightId}`;
            await axios.patch(updataFlightRequestURL, {totalSeats: updataTotalSeats});

            const updatedBooking = await this.bookingRepository.update(bookingId, 
                {
                    status: 'cancelled'
                });
            return updatedBooking

        } catch (error) {
            console.log('CANCEL BOOKING ERROR:', error);
            console.log('ERROR NAME:', error.name);
            console.log('ERROR MESSAGE:', error.message);
            console.log('ERROR STACK:', error.stack);
            if(error.name == 'RepositoryError' || error.name == 'ValidationError' || error.name == 'ServiceError') {
                throw error;
            }
            throw new ServiceError();
        }
    }
}

module.exports = BookingService;