import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('users/me/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) { }

  // GET /users/me/addresses
  @Get()
  async getAddresses(@CurrentUser() user: CurrentUserPayload) {
    return this.addressesService.getAddresses(user.userId);
  }

  // POST /users/me/addresses
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.createAddress(user.userId, dto);
  }

  // PATCH /users/me/addresses/:id
  @Patch(':id')
  async updateAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(user.userId, addressId, dto);
  }

  // DELETE /users/me/addresses/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAddress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') addressId: string,
  ) {
    return this.addressesService.deleteAddress(user.userId, addressId);
  }

  // PATCH /users/me/addresses/:id/default
  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') addressId: string,
  ) {
    return this.addressesService.setDefault(user.userId, addressId);
  }
}
