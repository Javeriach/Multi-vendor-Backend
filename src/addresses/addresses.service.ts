import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../entities/address.entity';
import { User } from '../entities/user.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,
  ) {}

  findAllForUser(userId: string): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { user: { id: userId } },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOwnedOrThrow(userId: string, id: string): Promise<Address> {
    const address = await this.addressesRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  async create(user: User, dto: CreateAddressDto): Promise<Address> {
    if (dto.isDefault) {
      await this.clearExistingDefault(user.id);
    }
    const address = this.addressesRepository.create({ ...dto, user });
    return this.addressesRepository.save(address);
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOwnedOrThrow(userId, id);
    if (dto.isDefault) {
      await this.clearExistingDefault(userId);
    }
    Object.assign(address, dto);
    return this.addressesRepository.save(address);
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwnedOrThrow(userId, id);
    await this.addressesRepository.softRemove(address);
  }

  private async clearExistingDefault(userId: string): Promise<void> {
    await this.addressesRepository.update(
      { user: { id: userId }, isDefault: true },
      { isDefault: false },
    );
  }
}
