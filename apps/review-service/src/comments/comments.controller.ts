import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentVisibilityDto } from './dto/update-visibility.dto';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('products/:productId')
  @Public()
  getByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryCommentsDto,
  ) {
    return this.commentsService.getByProduct(productId, query);
  }

  @Post()
  @Roles('customer', 'staff', 'admin')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: UserPayload) {
    return this.commentsService.createComment(dto, user);
  }

  @Post(':id/reply')
  @Roles('customer', 'staff', 'admin')
  @HttpCode(HttpStatus.CREATED)
  reply(
    @Param('id', ParseUUIDPipe) parentId: string,
    @Body() dto: ReplyCommentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.commentsService.replyComment(parentId, dto, user);
  }

  @Put(':id')
  @Roles('customer')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.commentsService.updateComment(id, dto, user);
  }

  @Delete(':id')
  @Roles('customer', 'admin')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserPayload) {
    return this.commentsService.deleteComment(id, user);
  }

  @Patch(':id/visibility')
  @Roles('admin')
  updateVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentVisibilityDto,
  ) {
    return this.commentsService.updateVisibility(id, dto);
  }
}
