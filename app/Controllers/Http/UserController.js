'use strict';

const fs = use('fs')
const {validate} = use('Validator');
const FileUtil = require('../../util/FileUtil')

const User = use("App/Models/User");
const Role = use("App/Models/Role");
const UserAvatar = use("App/Models/UserAvatar");
const PrivacySetting = use("App/Models/PrivacySetting");
const Helpers = use('Helpers')

const Hash = use('Hash');

class UserController {
  async register({request, response}) {

    const rules = {
      firstname: "required",
      lastname: "required",
      gender: "required",
      birthday: "required",
      email: "required|email|unique:users,email",
      password: "required"
    };

    const body = request.only(["firstname", "lastname", "email", "gender", "birthday", "password"]);

    // Validate input.
    const validation = await validate(body, rules);

    if (validation.fails()) {
      return response.status(400).json({
        status: "Error",
        message: validation.messages()
      });
    }

    const user = new User();

    user.firstname = body.firstname;
    user.lastname = body.lastname;
    user.email = body.email;
    user.gender = body.gender;
    user.birthday = body.birthday;
    user.password = body.password;

    await user.save();


    const setting = new PrivacySetting();
    setting.user_id = user.id;
    setting.profile_privacy = 'friends';
    setting.who_can_add = 'everyone';

    setting.save()

    const userRole = await Role.findBy("slug", "user");

    await user.Roles().attach([userRole.id]);

    fs.mkdirSync("./store/user/"+user.id);

    let path = "/"+user.id+"/"+`/${new Date().getTime()}.png`;
    FileUtil.copy('./store/default/account.png', "./store/user"+path, (err) => {
      if (err) return err;

    });

    const userAvatar = new UserAvatar();
    userAvatar.user_id = user.id;
    userAvatar.path = path;
    userAvatar.isCurrentAvatar = 1;
    userAvatar.save();

    return response.status(200).json({
      status: "Success",
      message: "The user was successfully created."
    });
  }

  async update({request, auth, response}) {

    const user = await User.find(request.only("id").id);
    if (!user) {
      return response.status(400).json({
        status: "Error",
        message: "Request was malformed"
      });
    }

    const rules = {
      first_name: "required",
      last_name: "required",
      email: "required|email",
      password: "required"
    };

    const body = {};

    body.first_name = request.input("first_name", user.firstname);
    body.last_name = request.input("last_name", user.lastname);
    body.gender = request.input("gender", user.gender);
    body.birthday = request.input("birthday", user.birthday);
    body.email = request.input("email", user.email);
    body.password = request.input("password", user.password);

    const validation = await validate(body, rules);

    if (validation.fails()) {
      return response.status(400).json({
        status: "Error",
        message: validation.messages()
      });
    }

    user.firstname = body.first_name;
    user.lastname = body.last_name;
    user.email = body.email;
    user.gender = body.gender
    user.birthday = body.birthday
    user.password = body.password;

    await user.save();

    return response.status(200).json({
      status: "Success",
      message: "The user was successfully updated."
    });
  }

  async delete({request, auth, response}) {
    const user = await User.find(request.only("id").id);

    if (!user) {
      return response.status(400).json({
        status: "Error",
        message: "Request was malformed"
      });
    }

    await user.delete();

    return response.status(200).json({
      status: "Success",
      message: "The user was successfully deleted."
    });
  }

  async getOne({request, params, auth, response}) {
    const user = await User.query()
      .innerJoin('privacy_settings', "privacy_settings.user_id",'users.id')
      .innerJoin('user_avatars', 'user_avatars.user_id', 'users.id')
      .where("users.id",params.id).first()

    if (!user) {
      return response.status(404).json({
        status: "Error",
        message: "Could not find the specified user."
      });
    }

    return response.status(200).json({
      status: "Success",
      message: "The user was successfully found.",
      data: user
    });
  }

  async getAll({request, params, auth, response}) {
    const users = await User.query().paginate(request.input("page", 1), request.input("limit", 20));

    if (!users) {
      return response.status(404).json({
        status: "Error",
        message: "Could not get the users"
      });
    }

    return response.status(200).json({
      status: "Success",
      message: "The users was successfully found.",
      data: users
    });
  }

  async login({request, auth, response}) {
    const rules = {
      email: "required|email",
      password: "required"
    };

    const body = request.only(["email", "password"]);

    const validation = await validate(body, rules);

    if (validation.fails()) {
      return response.status(400).json({
        status: "Error",
        message: validation.messages()
      });
    }

    const jwt = await auth.attempt(body.email, body.password);

    if (!jwt) {
      return response.status(500).json({
        status: "Error",
        message: "Unknown error"
      });
    }

    return response.status(200).json({
      status: "Success",
      message: "You have been successfully logged in.",
      data: jwt
    });
  }

  async getSelf({request, auth, response}) {
    const id = auth.user.id


    const user = await User.query()
      .innerJoin('role_user', 'role_user.user_id', 'users.id')
      .innerJoin('roles', 'roles.id','role_user.role_id')
      .innerJoin('user_avatars', 'user_avatars.user_id', 'users.id')
      .where("users.id", id).first()

    if (!user) {
      return response.status(404).json({
        status: "Error",
        message: "Could not find the specified user."
      });
    }
    return response.status(200).json({
      status: "Success",
      message: "The user was successfully found.",
      data: user
    });
  }

  async comparePassword({request, auth, response}) {
    const isSame = await Hash.verify(request.input("password"), request.input("hash"));
    if (isSame) {
      return response.status(200).json({
        status: "Success",
        message: "The passwords match."
      })
    } else {
      return response.status(401).json({
        status: "Error",
        message: "No match"
      })
    }
  }

  async search({request, auth, response}) {
    const {q} = request.only(['q'])
    if(q === ''){
      return response.status(400).json({
        status: "Error",
        message: "Missing query."
      });


    }
    const user = await User.query().select('users.id', 'users.firstname', 'users.lastname', 'ua.path').innerJoin("user_avatars as ua","ua.user_id", "users.id").where('firstname', 'LIKE', q+'%')
     .fetch()

    if (!user) {
      return response.status(404).json({
        status: "Error",
        message: "Could not find the specified user."
      });
    }

    return response.status(200).json({
      status: "Success",
      data: user
    });
  }
  async changeProfilePicture({request, auth, response}) {
    const profilePic = request.file('profile_pic', {
      types: ['image'],
      size: '2mb',
      extnames: ['png','jpg', 'jfif', 'gif']

    })

    if(!profilePic){
      return response.status(400).json({
        status: "error",
        message: "no file!"
      });
    }

    await profilePic.move(Helpers.tmpPath('uploads'), {
      name: `${new Date().getTime()}.${profilePic.subtype}`,
      overwrite: true
    })


    if (!profilePic.moved()) {
      return response.status(500).json({
        status: "error",
        message: profilePic.error()
      });

    }


    await FileUtil.move(profilePic.path, "../../store/user/"+request.id+"/"+profilePic.path)
    UserAvatar.query().where("user_id"+request.id).where("isCurrentAvatar",1).update({isCurrentAvatar:0})


    const userAvatar = new UserAvatar();

    userAvatar.user_id = request.id
    userAvatar.path ="/"+request.id+"/"+profilePic.path
    userAvatar.isCurrentAvatar = 1;
    userAvatar.save();

    return response.status(200).json({
      status: "Success",
      message: 'updated profile picture!'
    });
  }
}

module.exports = UserController;
