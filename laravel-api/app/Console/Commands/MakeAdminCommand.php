<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:create
                            {--name= : Admin name}
                            {--email= : Admin email}
                            {--phone= : Admin phone}
                            {--password= : Admin password}
                            {--super : Create as super admin}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new admin user';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $name = $this->option('name') ?? $this->ask('Enter admin name');
        $email = $this->option('email') ?? $this->ask('Enter admin email');
        $phone = $this->option('phone') ?? $this->ask('Enter admin phone (optional)', null);
        $password = $this->option('password') ?? $this->secret('Enter admin password');
        $isSuper = $this->option('super') ?? $this->confirm('Create as super admin?', false);

        // Validate required fields
        if (! $name || ! $email || ! $password) {
            $this->error('Name, email, and password are required.');

            return self::FAILURE;
        }

        // Check if email already exists
        if (Admin::where('email', $email)->exists()) {
            $this->error("An admin with email '{$email}' already exists.");

            return self::FAILURE;
        }

        // Create admin
        $admin = Admin::create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => Hash::make($password),
            'role' => $isSuper ? 'super_admin' : 'admin',
            'status' => 'active',
        ]);

        $this->info("Admin '{$admin->name}' created successfully!");
        $this->table(
            ['ID', 'Name', 'Email', 'Role', 'Status'],
            [[$admin->id, $admin->name, $admin->email, $admin->role, $admin->status]]
        );

        return self::SUCCESS;
    }
}
