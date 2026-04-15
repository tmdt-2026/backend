import {
  Controller, Get, Patch, Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ToggleActiveDto } from './dto/toggle-active.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles.constants';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // GET /users/me
  @Get('me')
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getProfile(user.userId);
  }

  // PATCH /users/me
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  // GET /users — admin, staff
  @Get()
  @Roles(ROLES.ADMIN, ROLES.STAFF)
  async listUsers(@Query() query: QueryUsersDto) {
    return this.usersService.listUsers(query);
  }

  // GET /users/:id — admin, staff
  @Get(':id')
  @Roles(ROLES.ADMIN, ROLES.STAFF)
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  // PATCH /users/:id/active — admin only
  @Patch(':id/active')
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleActive(
    @Param('id') targetUserId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ToggleActiveDto,
  ) {
    return this.usersService.toggleActive(targetUserId, user.userId, dto);
  }

  // PATCH /users/:id/roles — admin only
  @Patch(':id/roles')
  @Roles(ROLES.ADMIN)
  async updateRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.usersService.updateRoles(id, dto);
  }
}
