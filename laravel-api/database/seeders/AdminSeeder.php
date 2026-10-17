<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Idempotent: the default super admin is created once and updated
     * afterwards instead of being duplicated.
     */
    public function run(): void
    {
        // Create or update default super admin
        Admin::updateOrCreate(
            ['email' => 'admin@cos.local'],
            [
                'name' => 'Super Admin',
                'phone' => '09999999999',
                'password' => Hash::make('password'),
                'role' => 'super_admin',
                'status' => 'active',
            ],
        );

        $this->command->info('Default admin ready: admin@cos.local / password');
    }
}
