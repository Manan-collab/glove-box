import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  listFriends(@CurrentUser() user: SafeUser) {
    return this.friendsService.listFriends(user.id);
  }

  @Get('requests')
  listRequests(@CurrentUser() user: SafeUser) {
    return this.friendsService.listRequests(user.id);
  }

  @Get('search')
  searchUsers(
    @CurrentUser() user: SafeUser,
    @Query() query: SearchUsersQueryDto,
  ) {
    return this.friendsService.searchUsers(user.id, query.q);
  }

  @Post('requests/:username')
  sendRequest(
    @CurrentUser() user: SafeUser,
    @Param('username') username: string,
  ) {
    return this.friendsService.sendRequest(user.id, username);
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.friendsService.acceptRequest(user.id, id);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.friendsService.rejectRequest(user.id, id);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfriend(@CurrentUser() user: SafeUser, @Param('userId') userId: string) {
    return this.friendsService.unfriend(user.id, userId);
  }
}
